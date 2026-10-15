package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type app struct {
	db     *pgxpool.Pool
	secret []byte
	loc    *time.Location
}

type user struct {
	ID           string
	Nombre       string
	Email        string
	Rol          string
	EstudianteID string
	DocenteID    string
}

func main() {
	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
		_, err := c.Exec(ctx, `SET search_path TO core_academico, core_financiero, seguridad_auditoria, public`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	for i := 0; i < 30; i++ {
		if err = pool.Ping(ctx); err == nil {
			break
		}
		time.Sleep(time.Second)
	}
	if err != nil {
		log.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Bogota")
	if err != nil {
		loc = time.FixedZone("COT", -5*60*60)
	}
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret == "" {
		secret = "demo-webhook-secret"
	}
	a := &app{db: pool, secret: []byte(secret), loc: loc}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /v1/demo/sesion", a.entrar)
	mux.HandleFunc("DELETE /v1/demo/sesion", a.salir)
	mux.HandleFunc("GET /v1/sesion", a.sesion)
	mux.HandleFunc("GET /v1/estudiantes/me/dashboard", a.dashboard)
	mux.HandleFunc("GET /v1/prematricula", a.prematricula)
	mux.HandleFunc("PUT /v1/prematricula/seleccion", a.guardarSeleccion)
	mux.HandleFunc("POST /v1/prematricula/confirmar", a.confirmar)
	mux.HandleFunc("GET /v1/aula", a.aula)
	mux.HandleFunc("POST /v1/tareas/{id}/entregar", a.entregar)
	mux.HandleFunc("DELETE /v1/entregas/{id}", a.deshacerEntrega)
	mux.HandleFunc("GET /v1/cuentas", a.cuentas)
	mux.HandleFunc("POST /v1/pagos/intenciones", a.intencion)
	mux.HandleFunc("POST /v1/webhooks/pasarela", a.webhook)
	mux.HandleFunc("GET /v1/docente/grupos", a.gruposDocente)
	mux.HandleFunc("GET /v1/docente/grupos/{id}", a.detalleGrupo)
	mux.HandleFunc("POST /v1/docente/grupos/{id}/asistencia", a.pasarLista)
	mux.HandleFunc("PATCH /v1/docente/asistencia/{id}", a.marcarAsistencia)
	mux.HandleFunc("PUT /v1/docente/grupos/{id}/notas", a.guardarNotas)
	mux.HandleFunc("POST /v1/docente/grupos/{id}/publicar", a.publicarNotas)
	mux.HandleFunc("GET /v1/cartera", a.cartera)
	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("api escuchando en %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://localhost:3000" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Campus-Timestamp, X-Campus-Signature")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func writeErr(w http.ResponseWriter, status int, codigo, msg string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"codigo": codigo, "mensaje": msg},
	})
}

func readJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	return dec.Decode(dst)
}

func (a *app) currentUser(r *http.Request) (user, error) {
	c, err := r.Cookie("campus_demo")
	if err != nil || c.Value == "" {
		return user{}, errors.New("sin sesion")
	}
	var u user
	err = a.db.QueryRow(r.Context(), `
		SELECT u.id::text, u.nombre, u.email::text, r.codigo,
		       COALESCE(e.id::text, ''), COALESCE(d.id::text, '')
		FROM seguridad_auditoria.usuarios u
		JOIN seguridad_auditoria.usuarios_roles ur ON ur.usuario_id = u.id
		JOIN seguridad_auditoria.roles r ON r.id = ur.rol_id
		LEFT JOIN core_academico.estudiantes e ON e.usuario_id = u.id
		LEFT JOIN core_academico.docentes d ON d.usuario_id = u.id
		WHERE u.id = $1`, c.Value).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &u.EstudianteID, &u.DocenteID)
	return u, err
}

func (a *app) require(w http.ResponseWriter, r *http.Request, rol string) (user, bool) {
	u, err := a.currentUser(r)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "sin_sesion", "Entra con una cuenta de demostración.")
		return user{}, false
	}
	if rol != "" && u.Rol != rol {
		writeErr(w, http.StatusForbidden, "rol", "Esta vista es de otro rol.")
		return user{}, false
	}
	return u, true
}

func (a *app) entrar(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := readJSON(r, &body); err != nil || body.Email == "" {
		writeErr(w, http.StatusBadRequest, "solicitud", "Indica el correo de demostración.")
		return
	}
	var id, nombre, rol string
	err := a.db.QueryRow(r.Context(), `
		SELECT u.id::text, u.nombre, r.codigo
		FROM seguridad_auditoria.usuarios u
		JOIN seguridad_auditoria.usuarios_roles ur ON ur.usuario_id = u.id
		JOIN seguridad_auditoria.roles r ON r.id = ur.rol_id
		WHERE u.email = $1`, body.Email).Scan(&id, &nombre, &rol)
	if err != nil {
		writeErr(w, http.StatusNotFound, "usuario", "Ese correo no está en la muestra.")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "campus_demo",
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 60 * 12,
	})
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "nombre": nombre, "rol": rol, "email": body.Email})
}

func (a *app) salir(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "campus_demo", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, http.StatusOK, map[string]string{"estado": "cerrada"})
}

func (a *app) sesion(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "")
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"id": u.ID, "nombre": u.Nombre, "email": u.Email, "rol": u.Rol,
	})
}

func firmaValida(secret []byte, ts string, body []byte, firmaHex string) error {
	enviado, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return errors.New("marca de tiempo")
	}
	edad := time.Since(enviado)
	if edad > 5*time.Minute || edad < -time.Minute {
		return errors.New("fuera de ventana")
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(ts))
	mac.Write([]byte("."))
	mac.Write(body)
	recibida, err := hex.DecodeString(firmaHex)
	if err != nil || !hmac.Equal(mac.Sum(nil), recibida) {
		return errors.New("firma")
	}
	return nil
}

package main

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"time"
)

type sesion struct {
	Dia    int    `json:"dia"`
	Inicio string `json:"inicio"`
	Fin    string `json:"fin"`
}

type oferta struct {
	ID            string   `json:"grupo_id"`
	Codigo        string   `json:"codigo"`
	Nombre        string   `json:"asignatura"`
	Creditos      int      `json:"creditos"`
	Aula          string   `json:"aula"`
	Horario       string   `json:"horario"`
	PrereqOK      bool     `json:"prerrequisito_ok"`
	Faltante      string   `json:"faltante,omitempty"`
	Seleccionada  bool     `json:"seleccionada"`
	ConflictoCon  string   `json:"conflicto_con,omitempty"`
	Sesiones      []sesion `json:"-"`
}

func (a *app) dashboard(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	var nombrePrograma, codigo string
	var creditosGrado, creditosOk int
	var promedio string
	err := a.db.QueryRow(r.Context(), `
		SELECT e.codigo, p.nombre, p.creditos_grado,
		       COALESCE((
		         SELECT SUM(a2.creditos)::int
		         FROM core_academico.matriculas m
		         JOIN core_academico.grupos g ON g.id = m.grupo_id
		         JOIN core_academico.asignaturas a2 ON a2.id = g.asignatura_id
		         WHERE m.estudiante_id = e.id AND m.estado = 'aprobada'
		       ), 0),
		       COALESCE((
		         SELECT ROUND(SUM(c.nota * a2.creditos) / NULLIF(SUM(a2.creditos), 0), 2)::text
		         FROM core_academico.matriculas m
		         JOIN core_academico.grupos g ON g.id = m.grupo_id
		         JOIN core_academico.asignaturas a2 ON a2.id = g.asignatura_id
		         JOIN core_academico.calificaciones c
		           ON c.matricula_id = m.id AND c.componente = 'definitiva' AND c.publicada
		         WHERE m.estudiante_id = e.id AND m.estado = 'aprobada'
		       ), '0')
		FROM core_academico.estudiantes e
		JOIN core_academico.programas p ON p.id = e.programa_id
		WHERE e.id = $1`, u.EstudianteID).Scan(&codigo, &nombrePrograma, &creditosGrado, &creditosOk, &promedio)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "dashboard", "No se pudo armar el tablero.")
		return
	}
	proxima := a.proximaClase(r.Context(), u.EstudianteID)
	cuentas := a.alertas(r.Context(), u.EstudianteID)
	var prematriculaAbierta bool
	_ = a.db.QueryRow(r.Context(), `
		SELECT now() BETWEEN prematricula_abre AND prematricula_cierra
		FROM core_academico.periodos WHERE codigo = '2026-2'`).Scan(&prematriculaAbierta)
	writeJSON(w, http.StatusOK, map[string]any{
		"estudiante": map[string]string{"codigo": codigo, "nombre": u.Nombre, "programa": nombrePrograma},
		"kpis": map[string]any{
			"promedio_ponderado": promedio,
			"creditos":           map[string]int{"aprobados": creditosOk, "requeridos": creditosGrado},
			"proxima_clase":      proxima,
		},
		"alertas_financieras": cuentas,
		"prematricula_abierta": prematriculaAbierta,
	})
}

func (a *app) proximaClase(ctx context.Context, estudianteID string) any {
	rows, err := a.db.Query(ctx, `
		SELECT a.nombre, COALESCE(s.aula, ''), s.dia, to_char(s.inicio, 'HH24:MI'), to_char(s.fin, 'HH24:MI')
		FROM core_academico.matriculas m
		JOIN core_academico.grupos g ON g.id = m.grupo_id
		JOIN core_academico.asignaturas a ON a.id = g.asignatura_id
		JOIN core_academico.sesiones_horario s ON s.grupo_id = g.id
		WHERE m.estudiante_id = $1 AND m.estado = 'cursando'`, estudianteID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	now := time.Now().In(a.loc)
	var mejor time.Time
	var nombre, aula, inicio, fin string
	encontrada := false
	for rows.Next() {
		var n, au, ini, f string
		var dia int
		if err := rows.Scan(&n, &au, &dia, &ini, &f); err != nil {
			continue
		}
		cuando := siguiente(now, dia, ini, a.loc)
		if !encontrada || cuando.Before(mejor) {
			encontrada = true
			mejor = cuando
			nombre, aula, inicio, fin = n, au, ini, f
		}
	}
	if !encontrada {
		return nil
	}
	return map[string]string{
		"asignatura": nombre,
		"aula":       aula,
		"inicio":     inicio,
		"fin":        fin,
		"inicia_en":  mejor.Format(time.RFC3339),
	}
}

func siguiente(ahora time.Time, diaISO int, hhmm string, loc *time.Location) time.Time {
	hora, _ := time.ParseInLocation("15:04", hhmm, loc)
	hoy := int(ahora.Weekday())
	if hoy == 0 {
		hoy = 7
	}
	delta := diaISO - hoy
	if delta < 0 {
		delta += 7
	}
	cand := time.Date(ahora.Year(), ahora.Month(), ahora.Day(), hora.Hour(), hora.Minute(), 0, 0, loc).AddDate(0, 0, delta)
	if !cand.After(ahora) {
		cand = cand.AddDate(0, 0, 7)
	}
	return cand
}

func (a *app) alertas(ctx context.Context, estudianteID string) []map[string]string {
	rows, err := a.db.Query(ctx, `
		SELECT c.id::text, cp.nombre, c.numero,
		       (COALESCE(SUM(m.monto) FILTER (WHERE m.tipo IN ('cargo','reverso')), 0)
		        - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo IN ('abono','condonacion')), 0))::text,
		       c.moneda, c.vence_en::text, c.estado
		FROM core_financiero.cuentas_cobro c
		JOIN core_financiero.conceptos_pago cp ON cp.id = c.concepto_id
		LEFT JOIN core_financiero.movimientos m ON m.cuenta_id = c.id
		WHERE c.estudiante_id = $1 AND c.estado IN ('emitida','parcial','vencida','pagada')
		GROUP BY c.id, cp.nombre
		ORDER BY c.vence_en`, estudianteID)
	out := []map[string]string{}
	if err != nil {
		return out
	}
	defer rows.Close()
	hoy := time.Now().In(a.loc)
	for rows.Next() {
		var id, concepto, numero, saldo, moneda, vence, estado string
		if err := rows.Scan(&id, &concepto, &numero, &saldo, &moneda, &vence, &estado); err != nil {
			continue
		}
		sev := "ok"
		if estado != "pagada" {
			sev = "alerta"
			if t, err := time.Parse("2006-01-02", vence); err == nil && !t.After(hoy.AddDate(0, 0, -1)) {
				sev = "mora"
			}
		}
		out = append(out, map[string]string{
			"cuenta_id": id, "concepto": concepto, "numero": numero,
			"saldo": saldo, "moneda": moneda, "vence_en": vence,
			"estado": estado, "severidad": sev,
		})
	}
	return out
}

func (a *app) cargarOferta(ctx context.Context, estudianteID, prematriculaID string) ([]oferta, error) {
	rows, err := a.db.Query(ctx, `
		SELECT g.id::text, a.codigo, a.nombre, a.creditos::int, COALESCE(h.aula, ''),
		       COALESCE(h.sesiones, '[]'::json),
		       COALESCE(falta.nombres, '') = '' AS prereq_ok,
		       COALESCE(falta.nombres, ''),
		       EXISTS (
		         SELECT 1 FROM core_academico.prematricula_grupos pg
		         WHERE pg.prematricula_id = $2 AND pg.grupo_id = g.id
		       )
		FROM core_academico.grupos g
		JOIN core_academico.asignaturas a ON a.id = g.asignatura_id
		JOIN core_academico.periodos p ON p.id = g.periodo_id AND p.codigo = '2026-2'
		LEFT JOIN LATERAL (
		  SELECT (array_agg(s.aula ORDER BY s.dia))[1] AS aula,
		         json_agg(json_build_object(
		           'dia', s.dia,
		           'inicio', to_char(s.inicio, 'HH24:MI'),
		           'fin', to_char(s.fin, 'HH24:MI')
		         ) ORDER BY s.dia, s.inicio) AS sesiones
		  FROM core_academico.sesiones_horario s
		  WHERE s.grupo_id = g.id
		) h ON true
		LEFT JOIN LATERAL (
		  SELECT string_agg(r.nombre, ', ' ORDER BY r.nombre) AS nombres
		  FROM core_academico.prerrequisitos pr
		  JOIN core_academico.asignaturas r ON r.id = pr.requiere_id
		  WHERE pr.asignatura_id = a.id
		    AND NOT EXISTS (
		      SELECT 1
		      FROM core_academico.matriculas m
		      JOIN core_academico.grupos g2 ON g2.id = m.grupo_id
		      WHERE m.estudiante_id = $1
		        AND g2.asignatura_id = pr.requiere_id
		        AND m.estado = 'aprobada'
		    )
		) falta ON true
		WHERE NOT EXISTS (
		  SELECT 1
		  FROM core_academico.matriculas m
		  JOIN core_academico.grupos g2 ON g2.id = m.grupo_id
		  WHERE m.estudiante_id = $1
		    AND g2.asignatura_id = a.id
		    AND m.estado IN ('aprobada', 'cursando', 'confirmada')
		)
		ORDER BY a.nombre`, estudianteID, prematriculaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []oferta
	for rows.Next() {
		var o oferta
		var raw []byte
		if err := rows.Scan(&o.ID, &o.Codigo, &o.Nombre, &o.Creditos, &o.Aula, &raw, &o.PrereqOK, &o.Faltante, &o.Seleccionada); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &o.Sesiones)
		o.Horario = horarioTexto(o.Sesiones)
		list = append(list, o)
	}
	marcarConflictos(list)
	return list, nil
}

func horarioTexto(ss []sesion) string {
	dias := []string{"", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"}
	out := ""
	for i, s := range ss {
		if i > 0 {
			out += ", "
		}
		label := "?"
		if s.Dia >= 1 && s.Dia < len(dias) {
			label = dias[s.Dia]
		}
		out += label + " " + s.Inicio + "–" + s.Fin
	}
	return out
}

func cruza(a, b sesion) bool {
	return a.Dia == b.Dia && a.Inicio < b.Fin && b.Inicio < a.Fin
}

func marcarConflictos(list []oferta) {
	for i := range list {
		if !list[i].Seleccionada {
			continue
		}
		for j := range list {
			if i == j || !list[j].Seleccionada {
				continue
			}
			for _, sa := range list[i].Sesiones {
				for _, sb := range list[j].Sesiones {
					if cruza(sa, sb) {
						if list[i].ConflictoCon == "" {
							list[i].ConflictoCon = list[j].Nombre
						}
					}
				}
			}
		}
	}
}

func (a *app) asegurarPrematricula(ctx context.Context, estudianteID string) (string, string, error) {
	_, err := a.db.Exec(ctx, `
		INSERT INTO core_academico.prematriculas (estudiante_id, periodo_id)
		SELECT $1, id FROM core_academico.periodos WHERE codigo = '2026-2'
		ON CONFLICT (estudiante_id, periodo_id) DO NOTHING`, estudianteID)
	if err != nil {
		return "", "", err
	}
	var id, estado string
	var aplicada bool
	err = a.db.QueryRow(ctx, `
		SELECT pm.id::text, pm.estado, pm.sugerencia_aplicada
		FROM core_academico.prematriculas pm
		JOIN core_academico.periodos p ON p.id = pm.periodo_id
		WHERE pm.estudiante_id = $1 AND p.codigo = '2026-2'`, estudianteID).Scan(&id, &estado, &aplicada)
	if err != nil {
		return "", "", err
	}
	if estado == "borrador" && !aplicada {
		lista, err := a.cargarOferta(ctx, estudianteID, id)
		if err != nil {
			return "", "", err
		}
		sort.SliceStable(lista, func(i, j int) bool {
			di, dj := 9, 9
			ii, ij := "99:99", "99:99"
			if len(lista[i].Sesiones) > 0 {
				di, ii = lista[i].Sesiones[0].Dia, lista[i].Sesiones[0].Inicio
			}
			if len(lista[j].Sesiones) > 0 {
				dj, ij = lista[j].Sesiones[0].Dia, lista[j].Sesiones[0].Inicio
			}
			if di != dj {
				return di < dj
			}
			if ii != ij {
				return ii < ij
			}
			return lista[i].Nombre < lista[j].Nombre
		})
		var elegidas []oferta
		creditos := 0
		for _, g := range lista {
			if !g.PrereqOK {
				continue
			}
			choca := false
			for _, e := range elegidas {
				for _, sa := range g.Sesiones {
					for _, sb := range e.Sesiones {
						if cruza(sa, sb) {
							choca = true
						}
					}
				}
			}
			if choca || creditos+g.Creditos > 16 {
				continue
			}
			elegidas = append(elegidas, g)
			creditos += g.Creditos
		}
		for _, g := range elegidas {
			if _, err := a.db.Exec(ctx, `
				INSERT INTO core_academico.prematricula_grupos (prematricula_id, grupo_id)
				VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, g.ID); err != nil {
				return "", "", err
			}
		}
		if _, err := a.db.Exec(ctx, `
			UPDATE core_academico.prematriculas SET sugerencia_aplicada = true WHERE id = $1`, id); err != nil {
			return "", "", err
		}
	}
	return id, estado, nil
}

func (a *app) prematricula(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	id, estado, err := a.asegurarPrematricula(r.Context(), u.EstudianteID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "prematricula", "No se pudo abrir la prematrícula.")
		return
	}
	list, err := a.cargarOferta(r.Context(), u.EstudianteID, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "prematricula", "No se pudo listar la oferta.")
		return
	}
	creditos := 0
	conflictos := 0
	for _, g := range list {
		if g.Seleccionada {
			creditos += g.Creditos
			if g.ConflictoCon != "" {
				conflictos++
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"estado":                 estado,
		"grupos":                 list,
		"creditos_seleccionados": creditos,
		"conflictos":             conflictos,
		"estimado":               map[string]string{"monto": "13199940.00", "moneda": "COP"},
	})
}

func (a *app) guardarSeleccion(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	var body struct {
		GrupoIDs []string `json:"grupo_ids"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "solicitud", "La selección no tiene el formato esperado.")
		return
	}
	id, estado, err := a.asegurarPrematricula(r.Context(), u.EstudianteID)
	if err != nil || estado != "borrador" {
		writeErr(w, http.StatusConflict, "cerrada", "Esta prematrícula ya fue confirmada.")
		return
	}
	list, err := a.cargarOferta(r.Context(), u.EstudianteID, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "prematricula", "No se pudo validar la oferta.")
		return
	}
	permitidos := map[string]oferta{}
	for _, g := range list {
		permitidos[g.ID] = g
	}
	for _, gid := range body.GrupoIDs {
		g, ok := permitidos[gid]
		if !ok || !g.PrereqOK {
			writeErr(w, http.StatusUnprocessableEntity, "grupo", "Hay una materia que no puedes inscribir.")
			return
		}
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo guardar.")
		return
	}
	defer tx.Rollback(r.Context())
	if _, err := tx.Exec(r.Context(), `DELETE FROM core_academico.prematricula_grupos WHERE prematricula_id = $1`, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo guardar.")
		return
	}
	for _, gid := range body.GrupoIDs {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO core_academico.prematricula_grupos (prematricula_id, grupo_id) VALUES ($1, $2)`, id, gid); err != nil {
			writeErr(w, http.StatusInternalServerError, "tx", "No se pudo guardar.")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo guardar.")
		return
	}
	a.prematricula(w, r)
}

func (a *app) confirmar(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	var body struct {
		AceptaReglamento bool `json:"acepta_reglamento"`
	}
	if err := readJSON(r, &body); err != nil || !body.AceptaReglamento {
		writeErr(w, http.StatusBadRequest, "reglamento", "Acepta el reglamento para confirmar.")
		return
	}
	id, estado, err := a.asegurarPrematricula(r.Context(), u.EstudianteID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "prematricula", "No se pudo confirmar.")
		return
	}
	if estado == "confirmada" {
		writeJSON(w, http.StatusOK, map[string]string{"estado": "confirmada"})
		return
	}
	list, err := a.cargarOferta(r.Context(), u.EstudianteID, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "prematricula", "No se pudo confirmar.")
		return
	}
	var elegidas []oferta
	for _, g := range list {
		if g.Seleccionada {
			elegidas = append(elegidas, g)
			if g.ConflictoCon != "" || !g.PrereqOK {
				writeErr(w, http.StatusConflict, "conflicto_horario", g.Nombre+" se cruza o no cumple prerrequisito.")
				return
			}
		}
	}
	if len(elegidas) == 0 {
		writeErr(w, http.StatusBadRequest, "vacia", "Selecciona al menos una materia.")
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo confirmar.")
		return
	}
	defer tx.Rollback(r.Context())
	for _, g := range elegidas {
		var cupo, ocupados int
		if err := tx.QueryRow(r.Context(), `
			SELECT g.cupo,
			       (SELECT count(*) FROM core_academico.matriculas m
			        WHERE m.grupo_id = g.id AND m.estado <> 'cancelada')
			FROM core_academico.grupos g WHERE g.id = $1 FOR UPDATE`, g.ID).Scan(&cupo, &ocupados); err != nil {
			writeErr(w, http.StatusInternalServerError, "cupo", "No se pudo reservar el cupo.")
			return
		}
		if ocupados >= cupo {
			writeErr(w, http.StatusConflict, "cupo", g.Nombre+" no tiene cupo.")
			return
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO core_academico.matriculas (estudiante_id, grupo_id, periodo_id, estado)
			SELECT $1, g.id, g.periodo_id, 'confirmada'
			FROM core_academico.grupos g WHERE g.id = $2`, u.EstudianteID, g.ID); err != nil {
			writeErr(w, http.StatusConflict, "matricula", "Una materia ya estaba inscrita.")
			return
		}
	}
	if _, err := tx.Exec(r.Context(), `
		UPDATE core_academico.prematriculas
		SET estado = 'confirmada', reglamento_aceptado_en = now()
		WHERE id = $1 AND estado = 'borrador'`, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo confirmar.")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo confirmar.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"estado": "confirmada", "materias": len(elegidas)})
}

func (a *app) aula(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	rows, err := a.db.Query(r.Context(), `
		SELECT t.id::text, a.nombre, t.titulo, t.cierra_en,
		       e.id::text, e.estado, e.entregada_en
		FROM core_academico.tareas t
		JOIN core_academico.grupos g ON g.id = t.grupo_id
		JOIN core_academico.asignaturas a ON a.id = g.asignatura_id
		JOIN core_academico.matriculas m ON m.grupo_id = g.id AND m.estudiante_id = $1
		  AND m.estado IN ('cursando', 'confirmada')
		LEFT JOIN core_academico.entregas e
		  ON e.tarea_id = t.id AND e.estudiante_id = $1 AND e.estado = 'entregada'`, u.EstudianteID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "aula", "No se pudo abrir el aula.")
		return
	}
	defer rows.Close()
	type tarea struct {
		ID          string  `json:"id"`
		Asignatura  string  `json:"asignatura"`
		Titulo      string  `json:"titulo"`
		CierraEn    string  `json:"cierra_en"`
		EntregaID   *string `json:"entrega_id"`
		EntregadaEn *string `json:"entregada_en"`
	}
	var list []tarea
	for rows.Next() {
		var t tarea
		var cierra time.Time
		var entregaID, estado *string
		var entregada *time.Time
		if err := rows.Scan(&t.ID, &t.Asignatura, &t.Titulo, &cierra, &entregaID, &estado, &entregada); err != nil {
			writeErr(w, http.StatusInternalServerError, "aula", "No se pudo leer una tarea.")
			return
		}
		t.CierraEn = cierra.In(a.loc).Format(time.RFC3339)
		if entregaID != nil && estado != nil && *estado == "entregada" {
			t.EntregaID = entregaID
			if entregada != nil {
				s := entregada.In(a.loc).Format("15:04")
				t.EntregadaEn = &s
			}
		}
		list = append(list, t)
	}
	if list == nil {
		list = []tarea{}
	}
	clase := a.proximaClase(r.Context(), u.EstudianteID)
	writeJSON(w, http.StatusOK, map[string]any{"clase": clase, "tareas": list})
}

func (a *app) entregar(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	tareaID := r.PathValue("id")
	var entregaID string
	var cuando time.Time
	err := a.db.QueryRow(r.Context(), `
		INSERT INTO core_academico.entregas (tarea_id, estudiante_id, entregada_en, estado)
		SELECT t.id, $2, now(), 'entregada'
		FROM core_academico.tareas t
		JOIN core_academico.matriculas m ON m.grupo_id = t.grupo_id AND m.estudiante_id = $2
		  AND m.estado IN ('cursando', 'confirmada')
		WHERE t.id = $1
		ON CONFLICT (tarea_id, estudiante_id) DO UPDATE
		  SET estado = 'entregada', entregada_en = now()
		RETURNING id::text, entregada_en`, tareaID, u.EstudianteID).Scan(&entregaID, &cuando)
	if err != nil {
		writeErr(w, http.StatusNotFound, "tarea", "Esa tarea no está en tus clases.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"entrega_id": entregaID,
		"estado":     "entregada",
		"hora":       cuando.In(a.loc).Format("15:04"),
	})
}

func (a *app) deshacerEntrega(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		DELETE FROM core_academico.entregas
		WHERE id = $1 AND estudiante_id = $2 AND estado = 'entregada'
		  AND entregada_en > now() - interval '8 seconds'`, r.PathValue("id"), u.EstudianteID)
	if err != nil || tag.RowsAffected() == 0 {
		writeErr(w, http.StatusConflict, "ventana", "La ventana para deshacer ya cerró.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"estado": "retirada"})
}

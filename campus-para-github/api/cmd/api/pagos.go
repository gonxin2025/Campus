package main

import (
	"crypto/sha256"
	"encoding/json"
	"io"
	"net/http"
	"time"
)

func (a *app) cuentas(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cuentas": a.alertas(r.Context(), u.EstudianteID)})
}

func (a *app) intencion(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "estudiante")
	if !ok {
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		writeErr(w, http.StatusBadRequest, "idempotencia", "Falta Idempotency-Key.")
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "solicitud", "No se pudo leer el cuerpo.")
		return
	}
	var body struct {
		CuentaID string `json:"cuenta_id"`
	}
	if err := json.Unmarshal(raw, &body); err != nil || body.CuentaID == "" {
		writeErr(w, http.StatusBadRequest, "solicitud", "Indica la cuenta a pagar.")
		return
	}
	sum := sha256.Sum256(raw)
	var cuentaMonto string
	var estadoCuenta string
	err = a.db.QueryRow(r.Context(), `
		SELECT monto::text, estado FROM core_financiero.cuentas_cobro
		WHERE id = $1 AND estudiante_id = $2`, body.CuentaID, u.EstudianteID).Scan(&cuentaMonto, &estadoCuenta)
	if err != nil {
		writeErr(w, http.StatusNotFound, "cuenta", "Esa cuenta no es tuya.")
		return
	}
	if estadoCuenta == "pagada" {
		writeErr(w, http.StatusConflict, "pagada", "Esta cuenta ya está pagada.")
		return
	}
	var id, estado string
	var hash []byte
	err = a.db.QueryRow(r.Context(), `
		INSERT INTO core_financiero.transacciones
		  (cuenta_id, idempotency_key, solicitud_hash, proveedor, referencia_proveedor, monto, moneda, estado)
		SELECT c.id, $2, $3, 'simulada', $2, c.monto, c.moneda, 'pendiente'
		FROM core_financiero.cuentas_cobro c
		WHERE c.id = $1
		ON CONFLICT (idempotency_key) DO NOTHING
		RETURNING id::text, estado::text`, body.CuentaID, key, sum[:]).Scan(&id, &estado)
	if err != nil {
		err = a.db.QueryRow(r.Context(), `
			SELECT id::text, estado::text, solicitud_hash
			FROM core_financiero.transacciones WHERE idempotency_key = $1`, key).Scan(&id, &estado, &hash)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "pago", "No se pudo abrir la intención.")
			return
		}
		if sha256.Sum256(hash) != sha256.Sum256(sum[:]) && string(hash) != string(sum[:]) {
			same := len(hash) == len(sum) && string(hash) == string(sum[:])
			if !same {
				writeErr(w, http.StatusConflict, "idempotencia", "Esa clave ya se usó con otra solicitud.")
				return
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"transaccion_id":  id,
		"idempotency_key": key,
		"estado":          estado,
		"monto":           cuentaMonto,
		"checkout": map[string]string{
			"modo":      "simulada",
			"expira_en": time.Now().Add(15 * time.Minute).UTC().Format(time.RFC3339),
		},
	})
}

func (a *app) webhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "solicitud", "Cuerpo vacío.")
		return
	}
	if err := firmaValida(a.secret, r.Header.Get("X-Campus-Timestamp"), raw, r.Header.Get("X-Campus-Signature")); err != nil {
		writeErr(w, http.StatusUnauthorized, "firma", "La firma del webhook no es válida.")
		return
	}
	var body struct {
		EventoID       string `json:"evento_id"`
		TransaccionID  string `json:"transaccion_id"`
		Estado         string `json:"estado"`
	}
	if err := json.Unmarshal(raw, &body); err != nil || body.EventoID == "" || body.TransaccionID == "" {
		writeErr(w, http.StatusBadRequest, "evento", "El evento está incompleto.")
		return
	}
	if body.Estado != "capturada" {
		writeJSON(w, http.StatusOK, map[string]string{"estado": body.Estado})
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo aplicar el pago.")
		return
	}
	defer tx.Rollback(r.Context())
	var inserted string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO core_financiero.pasarelas_log
		  (proveedor, evento_id, firma_valida, transaccion_id, payload_redactado)
		VALUES ('simulada', $1, true, $2, $3::jsonb)
		ON CONFLICT (proveedor, evento_id) DO NOTHING
		RETURNING id::text`, body.EventoID, body.TransaccionID, string(raw)).Scan(&inserted)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"estado": "ya_aplicado"})
		return
	}
	var cuentaID, txEstado, monto string
	if err := tx.QueryRow(r.Context(), `
		SELECT cuenta_id::text, estado::text, monto::text
		FROM core_financiero.transacciones WHERE id = $1 FOR UPDATE`, body.TransaccionID).
		Scan(&cuentaID, &txEstado, &monto); err != nil {
		writeErr(w, http.StatusNotFound, "transaccion", "La transacción no existe.")
		return
	}
	var locked string
	if err := tx.QueryRow(r.Context(), `SELECT id::text FROM core_financiero.cuentas_cobro WHERE id = $1 FOR UPDATE`, cuentaID).Scan(&locked); err != nil {
		writeErr(w, http.StatusInternalServerError, "cuenta", "No se pudo bloquear la cuenta.")
		return
	}
	if txEstado == "pendiente" {
		if _, err := tx.Exec(r.Context(), `
			UPDATE core_financiero.transacciones
			SET estado = 'capturada', referencia_proveedor = $2
			WHERE id = $1 AND estado = 'pendiente'`, body.TransaccionID, body.EventoID); err != nil {
			writeErr(w, http.StatusInternalServerError, "tx", "No se pudo capturar.")
			return
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO core_financiero.movimientos (cuenta_id, transaccion_id, tipo, monto)
			VALUES ($1, $2, 'abono', $3::numeric)`, cuentaID, body.TransaccionID, monto); err != nil {
			writeErr(w, http.StatusInternalServerError, "libro", "No se pudo registrar el abono.")
			return
		}
		if _, err := tx.Exec(r.Context(), `
			UPDATE core_financiero.cuentas_cobro c
			SET estado = CASE
			  WHEN (
			    COALESCE((SELECT SUM(monto) FILTER (WHERE tipo IN ('cargo','reverso')) FROM core_financiero.movimientos WHERE cuenta_id = c.id), 0)
			    - COALESCE((SELECT SUM(monto) FILTER (WHERE tipo IN ('abono','condonacion')) FROM core_financiero.movimientos WHERE cuenta_id = c.id), 0)
			  ) <= 0 THEN 'pagada' ELSE 'parcial' END
			WHERE c.id = $1`, cuentaID); err != nil {
			writeErr(w, http.StatusInternalServerError, "cuenta", "No se pudo actualizar el saldo.")
			return
		}
	}
	var saldo string
	if err := tx.QueryRow(r.Context(), `
		SELECT (
		  COALESCE(SUM(monto) FILTER (WHERE tipo IN ('cargo','reverso')), 0)
		  - COALESCE(SUM(monto) FILTER (WHERE tipo IN ('abono','condonacion')), 0)
		)::text
		FROM core_financiero.movimientos WHERE cuenta_id = $1`, cuentaID).Scan(&saldo); err != nil {
		writeErr(w, http.StatusInternalServerError, "saldo", "No se pudo leer el saldo.")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudo cerrar el pago.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"estado": "capturada",
		"saldo":  saldo,
		"recibo": body.TransaccionID,
	})
}

func (a *app) cartera(w http.ResponseWriter, r *http.Request) {
	if _, ok := a.require(w, r, "tesoreria"); !ok {
		return
	}
	rows, err := a.db.Query(r.Context(), `
		SELECT c.numero, u.nombre, e.codigo, cp.nombre, c.monto::text,
		       (COALESCE(SUM(m.monto) FILTER (WHERE m.tipo IN ('cargo','reverso')), 0)
		        - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo IN ('abono','condonacion')), 0))::text,
		       c.estado, c.vence_en::text
		FROM core_financiero.cuentas_cobro c
		JOIN core_academico.estudiantes e ON e.id = c.estudiante_id
		JOIN seguridad_auditoria.usuarios u ON u.id = e.usuario_id
		JOIN core_financiero.conceptos_pago cp ON cp.id = c.concepto_id
		LEFT JOIN core_financiero.movimientos m ON m.cuenta_id = c.id
		GROUP BY c.id, u.nombre, e.codigo, cp.nombre
		ORDER BY c.vence_en`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "cartera", "No se pudo leer la cartera.")
		return
	}
	defer rows.Close()
	type fila struct {
		Numero   string `json:"numero"`
		Nombre   string `json:"estudiante"`
		Codigo   string `json:"codigo"`
		Concepto string `json:"concepto"`
		Monto    string `json:"monto"`
		Saldo    string `json:"saldo"`
		Estado   string `json:"estado"`
		Vence    string `json:"vence_en"`
	}
	var list []fila
	for rows.Next() {
		var f fila
		if err := rows.Scan(&f.Numero, &f.Nombre, &f.Codigo, &f.Concepto, &f.Monto, &f.Saldo, &f.Estado, &f.Vence); err != nil {
			writeErr(w, http.StatusInternalServerError, "cartera", "No se pudo leer una cuenta.")
			return
		}
		list = append(list, f)
	}
	if list == nil {
		list = []fila{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"cuentas": list})
}

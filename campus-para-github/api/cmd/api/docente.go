package main

import (
	"net/http"
	"time"
)

func (a *app) gruposDocente(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	rows, err := a.db.Query(r.Context(), `
		SELECT g.id::text, a.nombre, a.codigo, p.codigo,
		       (SELECT count(*) FROM core_academico.matriculas m
		        WHERE m.grupo_id = g.id AND m.estado IN ('cursando','confirmada'))
		FROM core_academico.grupos g
		JOIN core_academico.asignaturas a ON a.id = g.asignatura_id
		JOIN core_academico.periodos p ON p.id = g.periodo_id
		WHERE g.docente_id = $1 AND p.codigo = '2026-2'
		ORDER BY a.nombre`, u.DocenteID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "grupos", "No se pudieron listar los grupos.")
		return
	}
	defer rows.Close()
	type grupo struct {
		ID        string `json:"id"`
		Nombre    string `json:"nombre"`
		Codigo    string `json:"codigo"`
		Periodo   string `json:"periodo"`
		Estudiantes int  `json:"estudiantes"`
	}
	var list []grupo
	for rows.Next() {
		var g grupo
		if err := rows.Scan(&g.ID, &g.Nombre, &g.Codigo, &g.Periodo, &g.Estudiantes); err != nil {
			writeErr(w, http.StatusInternalServerError, "grupos", "No se pudo leer un grupo.")
			return
		}
		list = append(list, g)
	}
	if list == nil {
		list = []grupo{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"grupos": list})
}

func (a *app) detalleGrupo(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	grupoID := r.PathValue("id")
	var nombre string
	if err := a.db.QueryRow(r.Context(), `
		SELECT a.nombre FROM core_academico.grupos g
		JOIN core_academico.asignaturas a ON a.id = g.asignatura_id
		WHERE g.id = $1 AND g.docente_id = $2`, grupoID, u.DocenteID).Scan(&nombre); err != nil {
		writeErr(w, http.StatusNotFound, "grupo", "Ese grupo no es tuyo.")
		return
	}
	hoy := time.Now().In(a.loc).Format("2006-01-02")
	rows, err := a.db.Query(r.Context(), `
		SELECT e.codigo, u.nombre, m.id::text,
		       asi.id::text, asi.presente,
		       c.nota::text, COALESCE(c.publicada, false)
		FROM core_academico.matriculas m
		JOIN core_academico.estudiantes e ON e.id = m.estudiante_id
		JOIN seguridad_auditoria.usuarios u ON u.id = e.usuario_id
		LEFT JOIN core_academico.asistencias asi
		  ON asi.grupo_id = m.grupo_id AND asi.estudiante_id = e.id AND asi.fecha = $2
		LEFT JOIN core_academico.calificaciones c
		  ON c.matricula_id = m.id AND c.componente = 'parcial_1'
		WHERE m.grupo_id = $1 AND m.estado IN ('cursando','confirmada')
		ORDER BY u.nombre`, grupoID, hoy)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "grupo", "No se pudo abrir el grupo.")
		return
	}
	defer rows.Close()
	type est struct {
		Codigo     string  `json:"codigo"`
		Nombre     string  `json:"nombre"`
		Matricula  string  `json:"matricula_id"`
		Asistencia *string `json:"asistencia_id"`
		Presente   *bool   `json:"presente"`
		Nota       *string `json:"nota"`
		Publicada  bool    `json:"publicada"`
	}
	var list []est
	for rows.Next() {
		var e est
		if err := rows.Scan(&e.Codigo, &e.Nombre, &e.Matricula, &e.Asistencia, &e.Presente, &e.Nota, &e.Publicada); err != nil {
			writeErr(w, http.StatusInternalServerError, "grupo", "No se pudo leer un estudiante.")
			return
		}
		list = append(list, e)
	}
	if list == nil {
		list = []est{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"nombre": nombre, "fecha": hoy, "estudiantes": list})
}

func (a *app) pasarLista(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	grupoID := r.PathValue("id")
	hoy := time.Now().In(a.loc).Format("2006-01-02")
	tag, err := a.db.Exec(r.Context(), `
		INSERT INTO core_academico.asistencias (grupo_id, estudiante_id, fecha, presente, marcada_por)
		SELECT m.grupo_id, m.estudiante_id, $2, true, $3
		FROM core_academico.matriculas m
		JOIN core_academico.grupos g ON g.id = m.grupo_id
		WHERE m.grupo_id = $1 AND g.docente_id = $3
		  AND m.estado IN ('cursando','confirmada')
		ON CONFLICT (grupo_id, estudiante_id, fecha) DO NOTHING`, grupoID, hoy, u.DocenteID)
	if err != nil || tag.RowsAffected() == 0 && err != nil {
		writeErr(w, http.StatusNotFound, "grupo", "No se pudo pasar lista.")
		return
	}
	if err != nil {
		writeErr(w, http.StatusNotFound, "grupo", "No se pudo pasar lista.")
		return
	}
	a.detalleGrupo(w, r)
}

func (a *app) marcarAsistencia(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	var body struct {
		Presente bool `json:"presente"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "solicitud", "Indica presente.")
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE core_academico.asistencias asi
		SET presente = $3, marcada_en = now()
		FROM core_academico.grupos g
		WHERE asi.id = $1 AND asi.grupo_id = g.id AND g.docente_id = $2`,
		r.PathValue("id"), u.DocenteID, body.Presente)
	if err != nil || tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "asistencia", "Esa marca no es de tu grupo.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"presente": body.Presente})
}

func (a *app) guardarNotas(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	var body struct {
		Items []struct {
			MatriculaID string  `json:"matricula_id"`
			Nota        float64 `json:"nota"`
		} `json:"items"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "solicitud", "Las notas no tienen el formato esperado.")
		return
	}
	tx, err := a.db.Begin(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudieron guardar las notas.")
		return
	}
	defer tx.Rollback(r.Context())
	for _, item := range body.Items {
		if item.Nota < 0 || item.Nota > 5 {
			writeErr(w, http.StatusUnprocessableEntity, "nota", "La nota va de 0 a 5.")
			return
		}
		tag, err := tx.Exec(r.Context(), `
			INSERT INTO core_academico.calificaciones
			  (matricula_id, componente, nota, peso, publicada, docente_id)
			SELECT m.id, 'parcial_1', $3, 0.30, false, $2
			FROM core_academico.matriculas m
			JOIN core_academico.grupos g ON g.id = m.grupo_id
			WHERE m.id = $1 AND g.id = $4 AND g.docente_id = $2
			ON CONFLICT (matricula_id, componente) DO UPDATE
			  SET nota = EXCLUDED.nota
			  WHERE core_academico.calificaciones.publicada = false`,
			item.MatriculaID, u.DocenteID, item.Nota, r.PathValue("id"))
		if err != nil || tag.RowsAffected() == 0 {
			writeErr(w, http.StatusConflict, "nota", "Hay una nota publicada o una matrícula ajena.")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, "tx", "No se pudieron guardar las notas.")
		return
	}
	a.detalleGrupo(w, r)
}

func (a *app) publicarNotas(w http.ResponseWriter, r *http.Request) {
	u, ok := a.require(w, r, "docente")
	if !ok {
		return
	}
	tag, err := a.db.Exec(r.Context(), `
		UPDATE core_academico.calificaciones c
		SET publicada = true, publicada_en = now()
		FROM core_academico.matriculas m
		JOIN core_academico.grupos g ON g.id = m.grupo_id
		WHERE c.matricula_id = m.id AND c.componente = 'parcial_1'
		  AND g.id = $1 AND g.docente_id = $2 AND c.publicada = false`,
		r.PathValue("id"), u.DocenteID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "publicar", "No se pudieron publicar las notas.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"publicadas": tag.RowsAffected()})
}

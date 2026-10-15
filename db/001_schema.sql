CREATE SCHEMA core_academico;
CREATE SCHEMA core_financiero;
CREATE SCHEMA seguridad_auditoria;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE core_academico.estado_estudiante AS ENUM
  ('activo', 'inactivo', 'graduado', 'retirado', 'suspendido');
CREATE TYPE core_academico.estado_matricula AS ENUM
  ('prematricula', 'confirmada', 'cursando', 'aprobada', 'reprobada', 'cancelada');
CREATE TYPE core_financiero.estado_transaccion AS ENUM
  ('iniciada', 'pendiente', 'autorizada', 'capturada', 'fallida', 'reversada');

CREATE TABLE seguridad_auditoria.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  nombre text NOT NULL,
  mfa_enrolado boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'bloqueado', 'retirado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seguridad_auditoria.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL
);

CREATE TABLE core_academico.programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  creditos_grado smallint NOT NULL CHECK (creditos_grado > 0),
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE seguridad_auditoria.usuarios_roles (
  usuario_id uuid NOT NULL REFERENCES seguridad_auditoria.usuarios (id),
  rol_id uuid NOT NULL REFERENCES seguridad_auditoria.roles (id),
  programa_id uuid REFERENCES core_academico.programas (id),
  PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE core_academico.periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  inicio date NOT NULL,
  fin date NOT NULL,
  prematricula_abre timestamptz NOT NULL,
  prematricula_cierra timestamptz NOT NULL,
  CHECK (fin > inicio),
  CHECK (prematricula_cierra > prematricula_abre)
);

CREATE TABLE core_academico.estudiantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE REFERENCES seguridad_auditoria.usuarios (id),
  codigo text NOT NULL UNIQUE,
  programa_id uuid NOT NULL REFERENCES core_academico.programas (id),
  cohorte smallint NOT NULL CHECK (cohorte BETWEEN 2000 AND 2100),
  estado core_academico.estado_estudiante NOT NULL DEFAULT 'activo'
);

CREATE TABLE core_academico.docentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE REFERENCES seguridad_auditoria.usuarios (id),
  codigo text NOT NULL UNIQUE,
  dedicacion text NOT NULL
    CHECK (dedicacion IN ('catedra', 'medio_tiempo', 'tiempo_completo'))
);

CREATE TABLE core_academico.asignaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES core_academico.programas (id),
  codigo text NOT NULL,
  nombre text NOT NULL,
  creditos smallint NOT NULL CHECK (creditos BETWEEN 1 AND 12),
  UNIQUE (programa_id, codigo)
);

CREATE TABLE core_academico.prerrequisitos (
  asignatura_id uuid NOT NULL REFERENCES core_academico.asignaturas (id),
  requiere_id uuid NOT NULL REFERENCES core_academico.asignaturas (id),
  PRIMARY KEY (asignatura_id, requiere_id),
  CHECK (asignatura_id <> requiere_id)
);

CREATE TABLE core_academico.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignatura_id uuid NOT NULL REFERENCES core_academico.asignaturas (id),
  periodo_id uuid NOT NULL REFERENCES core_academico.periodos (id),
  docente_id uuid NOT NULL REFERENCES core_academico.docentes (id),
  codigo text NOT NULL,
  cupo smallint NOT NULL CHECK (cupo > 0),
  UNIQUE (asignatura_id, periodo_id, codigo)
);

CREATE TABLE core_academico.sesiones_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES core_academico.grupos (id) ON DELETE CASCADE,
  dia smallint NOT NULL CHECK (dia BETWEEN 1 AND 6),
  inicio time NOT NULL,
  fin time NOT NULL,
  aula text,
  CHECK (fin > inicio)
);

CREATE TABLE core_academico.prematriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES core_academico.estudiantes (id),
  periodo_id uuid NOT NULL REFERENCES core_academico.periodos (id),
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'confirmada', 'anulada')),
  reglamento_aceptado_en timestamptz,
  sugerencia_aplicada boolean NOT NULL DEFAULT false,
  UNIQUE (estudiante_id, periodo_id)
);

CREATE TABLE core_academico.prematricula_grupos (
  prematricula_id uuid NOT NULL
    REFERENCES core_academico.prematriculas (id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES core_academico.grupos (id),
  PRIMARY KEY (prematricula_id, grupo_id)
);

CREATE TABLE core_academico.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES core_academico.estudiantes (id),
  grupo_id uuid NOT NULL REFERENCES core_academico.grupos (id),
  periodo_id uuid NOT NULL REFERENCES core_academico.periodos (id),
  estado core_academico.estado_matricula NOT NULL DEFAULT 'prematricula',
  creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, grupo_id)
);

CREATE INDEX idx_matriculas_estudiante_periodo
  ON core_academico.matriculas (estudiante_id, periodo_id);

CREATE TABLE core_academico.calificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id uuid NOT NULL REFERENCES core_academico.matriculas (id),
  componente text NOT NULL,
  nota numeric(4,2) NOT NULL CHECK (nota >= 0 AND nota <= 5),
  peso numeric(5,4) NOT NULL CHECK (peso > 0 AND peso <= 1),
  publicada boolean NOT NULL DEFAULT false,
  publicada_en timestamptz,
  docente_id uuid NOT NULL REFERENCES core_academico.docentes (id),
  UNIQUE (matricula_id, componente)
);

CREATE TABLE core_academico.asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES core_academico.grupos (id),
  estudiante_id uuid NOT NULL REFERENCES core_academico.estudiantes (id),
  fecha date NOT NULL,
  presente boolean NOT NULL DEFAULT true,
  marcada_por uuid NOT NULL REFERENCES core_academico.docentes (id),
  marcada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, estudiante_id, fecha)
);

CREATE TABLE core_academico.tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES core_academico.grupos (id),
  titulo text NOT NULL,
  cierra_en timestamptz NOT NULL
);

CREATE TABLE core_academico.entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL REFERENCES core_academico.tareas (id),
  estudiante_id uuid NOT NULL REFERENCES core_academico.estudiantes (id),
  entregada_en timestamptz,
  estado text NOT NULL CHECK (estado IN ('borrador', 'entregada', 'calificada')),
  UNIQUE (tarea_id, estudiante_id)
);

CREATE TABLE core_financiero.conceptos_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  monto_base numeric(14,2) NOT NULL CHECK (monto_base >= 0),
  moneda char(3) NOT NULL DEFAULT 'COP'
);

CREATE TABLE core_financiero.cuentas_cobro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES core_academico.estudiantes (id),
  periodo_id uuid NOT NULL REFERENCES core_academico.periodos (id),
  concepto_id uuid NOT NULL REFERENCES core_financiero.conceptos_pago (id),
  numero text NOT NULL UNIQUE,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda char(3) NOT NULL DEFAULT 'COP',
  estado text NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada')),
  vence_en date NOT NULL
);

CREATE TABLE core_financiero.transacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL REFERENCES core_financiero.cuentas_cobro (id),
  idempotency_key text NOT NULL UNIQUE,
  solicitud_hash bytea NOT NULL,
  proveedor text NOT NULL,
  referencia_proveedor text,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda char(3) NOT NULL,
  estado core_financiero.estado_transaccion NOT NULL DEFAULT 'iniciada',
  creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, referencia_proveedor)
);

CREATE TABLE core_financiero.movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL REFERENCES core_financiero.cuentas_cobro (id),
  transaccion_id uuid REFERENCES core_financiero.transacciones (id),
  tipo text NOT NULL CHECK (tipo IN ('cargo', 'abono', 'reverso', 'condonacion')),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX unq_abono_por_transaccion
  ON core_financiero.movimientos (transaccion_id)
  WHERE tipo = 'abono' AND transaccion_id IS NOT NULL;

CREATE TABLE core_financiero.pasarelas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor text NOT NULL,
  evento_id text NOT NULL,
  firma_valida boolean NOT NULL,
  transaccion_id uuid REFERENCES core_financiero.transacciones (id),
  payload_redactado jsonb NOT NULL,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, evento_id)
);

CREATE INDEX idx_cuentas_cartera
  ON core_financiero.cuentas_cobro (estudiante_id, estado, vence_en);

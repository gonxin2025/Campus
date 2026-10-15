/**
 * API de muestra dentro de Next.js (reemplaza a la API Go + PostgreSQL para poder publicar en Vercel).
 *
 * - Los datos base (personas, oferta, cuenta de cobro) son constantes.
 * - Lo que cambia cada visitante (prematrícula, entregas, asistencia, notas, pagos) se guarda en una
 *   cookie de ese navegador. Así funciona igual en un servidor o en funciones serverless, y cada
 *   visitante tiene su propia muestra. "Salir" no borra ese estado: Ana paga, se sale, entra María
 *   (contable) en el mismo navegador y ve la cuenta pagada.
 */
import { cookies } from "next/headers";
import { createHash, randomUUID } from "crypto";

/* ------------------------------------------------------------------ datos base */

type Usuario = { id: string; email: string; nombre: string; rol: "estudiante" | "docente" | "tesoreria"; estudianteId?: string; docenteId?: string };
type Sesion = { dia: number; inicio: string; fin: string };
type Grupo = { id: string; asignatura: string; codigo: string; creditos: number; cupo: number; docenteId: string; aula: string; sesiones: Sesion[] };
type Estudiante = { id: string; usuarioId: string; codigo: string; nombre: string };
type Matricula = { id: string; estudianteId: string; grupoId: string; estado: "cursando" | "confirmada" | "aprobada" };
type Cuenta = { id: string; estudianteId: string; concepto: string; numero: string; monto: number; moneda: string; vence: string };

const PERIODO = "2026-2";
const PROGRAMA = { nombre: "Ingeniería de Sistemas", creditosGrado: 8 };
const PREMATRICULA_ABRE = Date.parse("2026-10-01T00:00:00-05:00");
const PREMATRICULA_CIERRA = Date.parse("2026-10-31T23:59:59-05:00");
const DOCENTE = "50000000-0000-4000-8000-000000000001";

const USUARIOS: Usuario[] = [
  { id: "11111111-1111-4111-8111-111111111111", email: "ana.ruiz@demo.local", nombre: "Ana Ruiz", rol: "estudiante", estudianteId: "40000000-0000-4000-8000-000000000001" },
  { id: "11111111-1111-4111-8111-111111111112", email: "luis.gomez@demo.local", nombre: "Luis Gómez", rol: "estudiante", estudianteId: "40000000-0000-4000-8000-000000000002" },
  { id: "22222222-2222-4222-8222-222222222222", email: "carlos.mendez@demo.local", nombre: "Carlos Méndez", rol: "docente", docenteId: DOCENTE },
  { id: "33333333-3333-4333-8333-333333333333", email: "maria.lopez@demo.local", nombre: "María López", rol: "tesoreria" },
];

const ESTUDIANTES: Estudiante[] = [
  { id: "40000000-0000-4000-8000-000000000001", usuarioId: USUARIOS[0].id, codigo: "DEMO-202612345", nombre: "Ana Ruiz" },
  { id: "40000000-0000-4000-8000-000000000002", usuarioId: USUARIOS[1].id, codigo: "DEMO-202498761", nombre: "Luis Gómez" },
];

const g = (n: string, asignatura: string, codigo: string, cupo: number, dia: number, inicio: string, fin: string): Grupo => ({
  id: `70000000-0000-4000-8000-0000000000${n}`,
  asignatura,
  codigo,
  creditos: 1,
  cupo,
  docenteId: DOCENTE,
  aula: "Muestra",
  sesiones: [{ dia, inicio, fin }],
});

const GRUPOS: Grupo[] = [
  g("07", "Ingeniería de Sistemas", "ISIS", 30, 2, "16:00", "18:00"),
  g("15", "Inglés nivel A", "INA", 25, 2, "18:00", "20:00"),
  g("16", "Inglés nivel B", "INB", 25, 2, "18:00", "20:00"),
  g("17", "Inglés nivel C", "INC", 25, 4, "18:00", "20:00"),
  g("18", "Diplomado en IA Generativa para la Educación", "DIA", 30, 1, "18:00", "20:00"),
  g("19", "Diplomado en IA aplicada en la Gerencia Pública", "DIP", 30, 3, "18:00", "20:00"),
];

const MATRICULAS_BASE: Matricula[] = [
  { id: "71000000-0000-4000-8000-000000000007", estudianteId: ESTUDIANTES[0].id, grupoId: GRUPOS[0].id, estado: "cursando" },
  { id: "71000000-0000-4000-8000-000000000008", estudianteId: ESTUDIANTES[1].id, grupoId: GRUPOS[0].id, estado: "cursando" },
];

/** Prematrícula sembrada para Ana (borrador, sin sugerencia aplicada). */
const PREMATRICULA_BASE: Record<string, string[]> = {
  [ESTUDIANTES[0].id]: [GRUPOS[1].id, GRUPOS[3].id, GRUPOS[4].id],
};

const TAREAS = [
  { id: "81000000-0000-4000-8000-000000000001", grupoId: GRUPOS[0].id, titulo: "Actividad de muestra del aula", cierra: "2026-10-20T23:59:00-05:00" },
];

const CUENTAS: Cuenta[] = [
  {
    id: "91000000-0000-4000-8000-000000000001",
    estudianteId: ESTUDIANTES[0].id,
    concepto: "Referencia 2026 · Ingeniería de Sistemas",
    numero: "REF-2026-ISIS-DEMO",
    monto: 13199940,
    moneda: "COP",
    vence: "2026-10-20",
  },
];

/* ------------------------------------------------------------------ estado por navegador */

type Estado = {
  pm: Record<string, { sel: string[]; est: "borrador" | "confirmada"; sug: boolean }>;
  mat: Matricula[];
  ent: Record<string, string>; // `${tareaId}~${estudianteId}` -> ISO de entrega
  asi: Record<string, { g: string; e: string; f: string; p: boolean }>;
  not: Record<string, { n: number; pub: boolean }>; // matrícula -> parcial_1
  tx: { id: string; c: string; k: string; h: string; s: "pendiente" | "capturada" }[];
  abo: Record<string, number>; // cuenta -> abonos acumulados
};

const COOKIE_ESTADO = "campus_estado";
const COOKIE_SESION = "campus_demo";
const DOCE_HORAS = 60 * 60 * 12;

function estadoVacio(): Estado {
  return { pm: {}, mat: [], ent: {}, asi: {}, not: {}, tx: [], abo: {} };
}

function leerEstado(): Estado {
  const raw = cookies().get(COOKIE_ESTADO)?.value;
  if (!raw) return estadoVacio();
  try {
    const e = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Estado>;
    return { ...estadoVacio(), ...e };
  } catch {
    return estadoVacio();
  }
}

function guardarEstado(e: Estado) {
  cookies().set(COOKIE_ESTADO, Buffer.from(JSON.stringify(e)).toString("base64url"), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: DOCE_HORAS,
  });
}

/* ------------------------------------------------------------------ utilidades */

export type Respuesta = { status: number; body: unknown };
const ok = (body: unknown): Respuesta => ({ status: 200, body });
const err = (status: number, codigo: string, mensaje: string): Respuesta => ({ status, body: { error: { codigo, mensaje } } });

const plata = (n: number) => n.toFixed(2);

/** Fecha y hora en Bogotá (UTC−5, sin horario de verano). */
function bogota(d = new Date()) {
  const t = new Date(d.getTime() - 5 * 3600 * 1000);
  return {
    fecha: t.toISOString().slice(0, 10),
    hora: t.toISOString().slice(11, 16),
    diaISO: ((t.getUTCDay() + 6) % 7) + 1,
    iso: t.toISOString().slice(0, 19) + "-05:00",
  };
}

function usuarioActual(): Usuario | null {
  const id = cookies().get(COOKIE_SESION)?.value;
  return USUARIOS.find((u) => u.id === id) ?? null;
}

function exigir(rol?: Usuario["rol"]): Usuario | Respuesta {
  const u = usuarioActual();
  if (!u) return err(401, "sin_sesion", "Entra con una cuenta de demostración.");
  if (rol && u.rol !== rol) return err(403, "rol", "Esta vista es de otro rol.");
  return u;
}
const esRespuesta = (x: unknown): x is Respuesta => typeof x === "object" && x !== null && "status" in x && "body" in x;

const grupo = (id: string) => GRUPOS.find((x) => x.id === id);
const matriculas = (e: Estado) => [...MATRICULAS_BASE, ...e.mat];

function horarioTexto(ss: Sesion[]) {
  const dias = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return ss.map((s) => `${dias[s.dia] ?? "?"} ${s.inicio}–${s.fin}`).join(", ");
}
const cruza = (a: Sesion, b: Sesion) => a.dia === b.dia && a.inicio < b.fin && b.inicio < a.fin;

/* ------------------------------------------------------------------ sesión */

export function entrar(body: { email?: string }): Respuesta {
  const u = USUARIOS.find((x) => x.email === (body.email ?? "").trim().toLowerCase());
  if (!u) return err(404, "usuario", "Ese correo no está en la muestra.");
  cookies().set(COOKIE_SESION, u.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: DOCE_HORAS });
  return ok({ id: u.id, nombre: u.nombre, rol: u.rol, email: u.email });
}

export function salir(): Respuesta {
  cookies().set(COOKIE_SESION, "", { path: "/", httpOnly: true, maxAge: 0 });
  return ok({ estado: "cerrada" });
}

export function sesion(): Respuesta {
  const u = exigir();
  if (esRespuesta(u)) return u;
  return ok({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol });
}

/* ------------------------------------------------------------------ estudiante */

function proximaClase(e: Estado, estudianteId: string) {
  const ahora = Date.now();
  const b = bogota();
  let mejor: { t: number; g: Grupo; s: Sesion } | null = null;
  for (const m of matriculas(e)) {
    if (m.estudianteId !== estudianteId || m.estado !== "cursando") continue;
    const gr = grupo(m.grupoId);
    if (!gr) continue;
    for (const s of gr.sesiones) {
      let delta = s.dia - b.diaISO;
      if (delta < 0) delta += 7;
      let t = Date.parse(`${b.fecha}T${s.inicio}:00-05:00`) + delta * 86400000;
      if (t <= ahora) t += 7 * 86400000;
      if (!mejor || t < mejor.t) mejor = { t, g: gr, s };
    }
  }
  if (!mejor) return null;
  return { asignatura: mejor.g.asignatura, aula: mejor.g.aula, inicio: mejor.s.inicio, fin: mejor.s.fin, inicia_en: bogota(new Date(mejor.t)).iso };
}

function saldoCuenta(e: Estado, c: Cuenta) {
  return c.monto - (e.abo[c.id] ?? 0);
}
function estadoCuenta(e: Estado, c: Cuenta) {
  const abonado = e.abo[c.id] ?? 0;
  if (abonado <= 0) return "emitida";
  return saldoCuenta(e, c) <= 0 ? "pagada" : "parcial";
}

function alertas(e: Estado, estudianteId: string) {
  const ayer = Date.now() - 86400000;
  return CUENTAS.filter((c) => c.estudianteId === estudianteId)
    .sort((a, b) => a.vence.localeCompare(b.vence))
    .map((c) => {
      const estado = estadoCuenta(e, c);
      let severidad = "ok";
      if (estado !== "pagada") severidad = Date.parse(c.vence + "T00:00:00Z") <= ayer ? "mora" : "alerta";
      return { cuenta_id: c.id, concepto: c.concepto, numero: c.numero, saldo: plata(saldoCuenta(e, c)), moneda: c.moneda, vence_en: c.vence, estado, severidad };
    });
}

export function dashboard(): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const est = ESTUDIANTES.find((x) => x.id === u.estudianteId)!;
  const ahora = Date.now();
  return ok({
    estudiante: { codigo: est.codigo, nombre: u.nombre, programa: PROGRAMA.nombre },
    kpis: { promedio_ponderado: "0", creditos: { aprobados: 0, requeridos: PROGRAMA.creditosGrado }, proxima_clase: proximaClase(e, est.id) },
    alertas_financieras: alertas(e, est.id),
    prematricula_abierta: ahora >= PREMATRICULA_ABRE && ahora <= PREMATRICULA_CIERRA,
  });
}

type Oferta = {
  grupo_id: string;
  codigo: string;
  asignatura: string;
  creditos: number;
  aula: string;
  horario: string;
  prerrequisito_ok: boolean;
  seleccionada: boolean;
  conflicto_con?: string;
  sesiones: Sesion[];
};

function oferta(e: Estado, estudianteId: string): Oferta[] {
  const tomadas = new Set(
    matriculas(e)
      .filter((m) => m.estudianteId === estudianteId && ["aprobada", "cursando", "confirmada"].includes(m.estado))
      .map((m) => grupo(m.grupoId)?.codigo),
  );
  const sel = new Set(e.pm[estudianteId]?.sel ?? []);
  const lista: Oferta[] = GRUPOS.filter((gr) => !tomadas.has(gr.codigo))
    .map((gr) => ({
      grupo_id: gr.id,
      codigo: gr.codigo,
      asignatura: gr.asignatura,
      creditos: gr.creditos,
      aula: gr.aula,
      horario: horarioTexto(gr.sesiones),
      prerrequisito_ok: true, // la muestra no tiene prerrequisitos
      seleccionada: sel.has(gr.id),
      sesiones: gr.sesiones,
    }))
    .sort((a, b) => a.asignatura.localeCompare(b.asignatura, "es"));
  for (const a of lista) {
    if (!a.seleccionada) continue;
    for (const b of lista) {
      if (a === b || !b.seleccionada) continue;
      if (!a.conflicto_con && a.sesiones.some((sa) => b.sesiones.some((sb) => cruza(sa, sb)))) a.conflicto_con = b.asignatura;
    }
  }
  return lista;
}

const sinSesiones = (l: Oferta[]) => l.map(({ sesiones: _s, ...resto }) => resto);

/** Crea la prematrícula si no existe y, la primera vez, completa una sugerencia sin cruces (máx. 16 créditos). */
function asegurarPrematricula(e: Estado, estudianteId: string) {
  if (!e.pm[estudianteId]) e.pm[estudianteId] = { sel: [...(PREMATRICULA_BASE[estudianteId] ?? [])], est: "borrador", sug: false };
  const pm = e.pm[estudianteId];
  if (pm.est === "borrador" && !pm.sug) {
    const primera = (o: Oferta) => o.sesiones[0] ?? { dia: 9, inicio: "99:99", fin: "" };
    const lista = oferta(e, estudianteId).sort(
      (a, b) => primera(a).dia - primera(b).dia || primera(a).inicio.localeCompare(primera(b).inicio) || a.asignatura.localeCompare(b.asignatura, "es"),
    );
    const elegidas: Oferta[] = [];
    let creditos = 0;
    for (const o of lista) {
      if (!o.prerrequisito_ok) continue;
      const choca = elegidas.some((x) => o.sesiones.some((sa) => x.sesiones.some((sb) => cruza(sa, sb))));
      if (choca || creditos + o.creditos > 16) continue;
      elegidas.push(o);
      creditos += o.creditos;
    }
    for (const o of elegidas) if (!pm.sel.includes(o.grupo_id)) pm.sel.push(o.grupo_id);
    pm.sug = true;
  }
  return pm;
}

function vistaPrematricula(e: Estado, estudianteId: string): Respuesta {
  const pm = asegurarPrematricula(e, estudianteId);
  const lista = oferta(e, estudianteId);
  const elegidas = lista.filter((o) => o.seleccionada);
  return ok({
    estado: pm.est,
    grupos: sinSesiones(lista),
    creditos_seleccionados: elegidas.reduce((s, o) => s + o.creditos, 0),
    conflictos: elegidas.filter((o) => o.conflicto_con).length,
    estimado: { monto: "13199940.00", moneda: "COP" },
  });
}

export function prematricula(): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const r = vistaPrematricula(e, u.estudianteId!);
  guardarEstado(e);
  return r;
}

export function guardarSeleccion(body: { grupo_ids?: unknown }): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  if (!Array.isArray(body.grupo_ids)) return err(400, "solicitud", "La selección no tiene el formato esperado.");
  const e = leerEstado();
  const pm = asegurarPrematricula(e, u.estudianteId!);
  if (pm.est !== "borrador") return err(409, "cerrada", "Esta prematrícula ya fue confirmada.");
  const permitidos = new Set(oferta(e, u.estudianteId!).map((o) => o.grupo_id));
  const ids = body.grupo_ids.map(String);
  if (ids.some((id) => !permitidos.has(id))) return err(422, "grupo", "Hay una materia que no puedes inscribir.");
  pm.sel = [...new Set(ids)];
  const r = vistaPrematricula(e, u.estudianteId!);
  guardarEstado(e);
  return r;
}

export function confirmar(body: { acepta_reglamento?: boolean }): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  if (!body.acepta_reglamento) return err(400, "reglamento", "Acepta el reglamento para confirmar.");
  const e = leerEstado();
  const est = u.estudianteId!;
  const pm = asegurarPrematricula(e, est);
  if (pm.est === "confirmada") return ok({ estado: "confirmada" });
  const elegidas = oferta(e, est).filter((o) => o.seleccionada);
  const mala = elegidas.find((o) => o.conflicto_con || !o.prerrequisito_ok);
  if (mala) return err(409, "conflicto_horario", `${mala.asignatura} se cruza o no cumple prerrequisito.`);
  if (!elegidas.length) return err(400, "vacia", "Selecciona al menos una materia.");
  for (const o of elegidas) {
    const gr = grupo(o.grupo_id)!;
    const ocupados = matriculas(e).filter((m) => m.grupoId === gr.id).length;
    if (ocupados >= gr.cupo) return err(409, "cupo", `${gr.asignatura} no tiene cupo.`);
  }
  for (const o of elegidas) e.mat.push({ id: randomUUID(), estudianteId: est, grupoId: o.grupo_id, estado: "confirmada" });
  pm.est = "confirmada";
  guardarEstado(e);
  return ok({ estado: "confirmada", materias: elegidas.length });
}

export function aula(): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const est = u.estudianteId!;
  const misGrupos = new Set(matriculas(e).filter((m) => m.estudianteId === est && ["cursando", "confirmada"].includes(m.estado)).map((m) => m.grupoId));
  const tareas = TAREAS.filter((t) => misGrupos.has(t.grupoId)).map((t) => {
    const entregada = e.ent[`${t.id}~${est}`];
    return {
      id: t.id,
      asignatura: grupo(t.grupoId)!.asignatura,
      titulo: t.titulo,
      cierra_en: t.cierra,
      entrega_id: entregada ? `${t.id}~${est}` : null,
      entregada_en: entregada ? bogota(new Date(entregada)).hora : null,
    };
  });
  return ok({ clase: proximaClase(e, est), tareas });
}

export function entregar(tareaId: string): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const est = u.estudianteId!;
  const t = TAREAS.find((x) => x.id === tareaId);
  const inscrito = t && matriculas(e).some((m) => m.estudianteId === est && m.grupoId === t.grupoId && ["cursando", "confirmada"].includes(m.estado));
  if (!t || !inscrito) return err(404, "tarea", "Esa tarea no está en tus clases.");
  const ahora = new Date();
  const clave = `${t.id}~${est}`;
  e.ent[clave] = ahora.toISOString();
  guardarEstado(e);
  return ok({ entrega_id: clave, estado: "entregada", hora: bogota(ahora).hora });
}

export function deshacerEntrega(entregaId: string): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const cuando = e.ent[entregaId];
  if (!cuando || !entregaId.endsWith(`~${u.estudianteId}`) || Date.now() - Date.parse(cuando) > 8000) {
    return err(409, "ventana", "La ventana para deshacer ya cerró.");
  }
  delete e.ent[entregaId];
  guardarEstado(e);
  return ok({ estado: "retirada" });
}

/* ------------------------------------------------------------------ docente */

export function gruposDocente(): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const grupos = GRUPOS.filter((gr) => gr.docenteId === u.docenteId)
    .map((gr) => ({
      id: gr.id,
      nombre: gr.asignatura,
      codigo: gr.codigo,
      periodo: PERIODO,
      estudiantes: matriculas(e).filter((m) => m.grupoId === gr.id && ["cursando", "confirmada"].includes(m.estado)).length,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return ok({ grupos });
}

function vistaGrupo(e: Estado, docenteId: string, grupoId: string): Respuesta {
  const gr = grupo(grupoId);
  if (!gr || gr.docenteId !== docenteId) return err(404, "grupo", "Ese grupo no es tuyo.");
  const hoy = bogota().fecha;
  const estudiantes = matriculas(e)
    .filter((m) => m.grupoId === gr.id && ["cursando", "confirmada"].includes(m.estado))
    .map((m) => {
      const est = ESTUDIANTES.find((x) => x.id === m.estudianteId)!;
      const asiId = `asi~${gr.id}~${est.id}~${hoy}`;
      const asi = e.asi[asiId];
      const nota = e.not[m.id];
      return {
        codigo: est.codigo,
        nombre: est.nombre,
        matricula_id: m.id,
        asistencia_id: asi ? asiId : null,
        presente: asi ? asi.p : null,
        nota: nota ? nota.n.toFixed(2) : null,
        publicada: nota?.pub ?? false,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return ok({ nombre: gr.asignatura, fecha: hoy, estudiantes });
}

export function detalleGrupo(grupoId: string): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  return vistaGrupo(leerEstado(), u.docenteId!, grupoId);
}

export function pasarLista(grupoId: string): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const gr = grupo(grupoId);
  if (!gr || gr.docenteId !== u.docenteId) return err(404, "grupo", "No se pudo pasar lista.");
  const hoy = bogota().fecha;
  for (const m of matriculas(e)) {
    if (m.grupoId !== gr.id || !["cursando", "confirmada"].includes(m.estado)) continue;
    const id = `asi~${gr.id}~${m.estudianteId}~${hoy}`;
    if (!e.asi[id]) e.asi[id] = { g: gr.id, e: m.estudianteId, f: hoy, p: true };
  }
  guardarEstado(e);
  return vistaGrupo(e, u.docenteId!, grupoId);
}

export function marcarAsistencia(asistenciaId: string, body: { presente?: boolean }): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  if (typeof body.presente !== "boolean") return err(400, "solicitud", "Indica presente.");
  const e = leerEstado();
  const asi = e.asi[asistenciaId];
  if (!asi || grupo(asi.g)?.docenteId !== u.docenteId) return err(404, "asistencia", "Esa marca no es de tu grupo.");
  asi.p = body.presente;
  guardarEstado(e);
  return ok({ presente: body.presente });
}

export function guardarNotas(grupoId: string, body: { items?: { matricula_id: string; nota: number }[] }): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  if (!Array.isArray(body.items)) return err(400, "solicitud", "Las notas no tienen el formato esperado.");
  const e = leerEstado();
  const gr = grupo(grupoId);
  for (const item of body.items) {
    const nota = Number(item.nota);
    if (!(nota >= 0 && nota <= 5)) return err(422, "nota", "La nota va de 0 a 5.");
    const m = matriculas(e).find((x) => x.id === item.matricula_id && x.grupoId === grupoId);
    if (!gr || gr.docenteId !== u.docenteId || !m || e.not[m.id]?.pub) return err(409, "nota", "Hay una nota publicada o una matrícula ajena.");
  }
  for (const item of body.items) e.not[item.matricula_id] = { n: Number(item.nota), pub: false };
  guardarEstado(e);
  return vistaGrupo(e, u.docenteId!, grupoId);
}

export function publicarNotas(grupoId: string): Respuesta {
  const u = exigir("docente");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const gr = grupo(grupoId);
  if (!gr || gr.docenteId !== u.docenteId) return ok({ publicadas: 0 });
  let publicadas = 0;
  for (const m of matriculas(e)) {
    const n = m.grupoId === gr.id ? e.not[m.id] : undefined;
    if (n && !n.pub) {
      n.pub = true;
      publicadas++;
    }
  }
  guardarEstado(e);
  return ok({ publicadas });
}

/* ------------------------------------------------------------------ pagos y cartera */

export function cuentas(): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  return ok({ cuentas: alertas(leerEstado(), u.estudianteId!) });
}

export function intencion(idempotencyKey: string | null, raw: string): Respuesta {
  const u = exigir("estudiante");
  if (esRespuesta(u)) return u;
  if (!idempotencyKey) return err(400, "idempotencia", "Falta Idempotency-Key.");
  let cuentaId = "";
  try {
    cuentaId = String((JSON.parse(raw) as { cuenta_id?: string }).cuenta_id ?? "");
  } catch {
    /* cuerpo inválido */
  }
  if (!cuentaId) return err(400, "solicitud", "Indica la cuenta a pagar.");
  const e = leerEstado();
  const c = CUENTAS.find((x) => x.id === cuentaId && x.estudianteId === u.estudianteId);
  if (!c) return err(404, "cuenta", "Esa cuenta no es tuya.");
  if (estadoCuenta(e, c) === "pagada") return err(409, "pagada", "Esta cuenta ya está pagada.");
  const hash = createHash("sha256").update(raw).digest("hex");
  let tx = e.tx.find((t) => t.k === idempotencyKey);
  if (tx && tx.h !== hash) return err(409, "idempotencia", "Esa clave ya se usó con otra solicitud.");
  if (!tx) {
    tx = { id: randomUUID(), c: c.id, k: idempotencyKey, h: hash, s: "pendiente" };
    e.tx.push(tx);
    guardarEstado(e);
  }
  return ok({
    transaccion_id: tx.id,
    idempotency_key: idempotencyKey,
    estado: tx.s,
    monto: plata(c.monto),
    checkout: { modo: "simulada", expira_en: new Date(Date.now() + 15 * 60000).toISOString() },
  });
}

/** Lo que haría el webhook firmado de la pasarela: captura la transacción y abona la cuenta. */
export function capturarPago(transaccionId: string): Respuesta {
  if (!transaccionId) return err(400, "evento", "El evento está incompleto.");
  const e = leerEstado();
  const tx = e.tx.find((t) => t.id === transaccionId);
  if (!tx) return err(404, "transaccion", "La transacción no existe.");
  const c = CUENTAS.find((x) => x.id === tx.c)!;
  if (tx.s === "pendiente") {
    tx.s = "capturada";
    e.abo[c.id] = (e.abo[c.id] ?? 0) + c.monto;
    guardarEstado(e);
  }
  return ok({ estado: "capturada", saldo: plata(Math.max(saldoCuenta(e, c), 0)), recibo: tx.id });
}

export function cartera(): Respuesta {
  const u = exigir("tesoreria");
  if (esRespuesta(u)) return u;
  const e = leerEstado();
  const filas = [...CUENTAS]
    .sort((a, b) => a.vence.localeCompare(b.vence))
    .map((c) => {
      const est = ESTUDIANTES.find((x) => x.id === c.estudianteId)!;
      return {
        numero: c.numero,
        estudiante: est.nombre,
        codigo: est.codigo,
        concepto: c.concepto,
        monto: plata(c.monto),
        saldo: plata(Math.max(saldoCuenta(e, c), 0)),
        estado: estadoCuenta(e, c),
        vence_en: c.vence,
      };
    });
  return ok({ cuentas: filas });
}

/* ------------------------------------------------------------------ enrutador /v1 */

export async function despachar(req: Request, metodo: string, ruta: string[]): Promise<Respuesta> {
  const p = ruta.join("/");
  const leer = async <T,>(): Promise<T> => {
    try {
      return (await req.json()) as T;
    } catch {
      return {} as T;
    }
  };
  const m = (re: RegExp) => p.match(re);
  let x: RegExpMatchArray | null;

  if (p === "demo/sesion" && metodo === "POST") return entrar(await leer());
  if (p === "demo/sesion" && metodo === "DELETE") return salir();
  if (p === "sesion" && metodo === "GET") return sesion();
  if (p === "estudiantes/me/dashboard" && metodo === "GET") return dashboard();
  if (p === "prematricula" && metodo === "GET") return prematricula();
  if (p === "prematricula/seleccion" && metodo === "PUT") return guardarSeleccion(await leer());
  if (p === "prematricula/confirmar" && metodo === "POST") return confirmar(await leer());
  if (p === "aula" && metodo === "GET") return aula();
  if ((x = m(/^tareas\/([^/]+)\/entregar$/)) && metodo === "POST") return entregar(decodeURIComponent(x[1]));
  if ((x = m(/^entregas\/([^/]+)$/)) && metodo === "DELETE") return deshacerEntrega(decodeURIComponent(x[1]));
  if (p === "cuentas" && metodo === "GET") return cuentas();
  if (p === "pagos/intenciones" && metodo === "POST") return intencion(req.headers.get("Idempotency-Key"), await req.text());
  if (p === "cartera" && metodo === "GET") return cartera();
  if (p === "docente/grupos" && metodo === "GET") return gruposDocente();
  if ((x = m(/^docente\/grupos\/([^/]+)$/)) && metodo === "GET") return detalleGrupo(x[1]);
  if ((x = m(/^docente\/grupos\/([^/]+)\/asistencia$/)) && metodo === "POST") return pasarLista(x[1]);
  if ((x = m(/^docente\/asistencia\/([^/]+)$/)) && metodo === "PATCH") return marcarAsistencia(decodeURIComponent(x[1]), await leer());
  if ((x = m(/^docente\/grupos\/([^/]+)\/notas$/)) && metodo === "PUT") return guardarNotas(x[1], await leer());
  if ((x = m(/^docente\/grupos\/([^/]+)\/publicar$/)) && metodo === "POST") return publicarNotas(x[1]);
  return err(404, "ruta", "Esa ruta no existe en la muestra.");
}

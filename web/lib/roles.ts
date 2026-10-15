export type RolId = "estudiante" | "docente" | "tesoreria" | "comercial" | "administrativo";

export type Cuenta = {
  email: string;
  nombre: string;
  rol: RolId;
  detalle: string;
  /** true: la cuenta existe en la API de muestra (/v1, sesión con cookie). false: solo en este navegador. */
  api: boolean;
};

export const CLAVE_MUESTRA = "campus";

export const ETIQUETA: Record<RolId, string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  tesoreria: "Contable",
  comercial: "Asesor",
  administrativo: "Administrativo",
};

export const DESTINO: Record<RolId, string> = {
  estudiante: "/estudiante",
  docente: "/docente",
  tesoreria: "/tesoreria",
  comercial: "/comercial",
  administrativo: "/administrativo",
};

export const CUENTAS: Cuenta[] = [
  { email: "ana.ruiz@demo.local", nombre: "Ana Ruiz", rol: "estudiante", detalle: "Ingeniería de Sistemas · convenio FUAC", api: true },
  { email: "carlos.mendez@demo.local", nombre: "Carlos Méndez", rol: "docente", detalle: "Grupos, asistencia y notas", api: true },
  { email: "maria.lopez@demo.local", nombre: "María López", rol: "tesoreria", detalle: "Cartera, recaudo y conciliación de pagos", api: true },
  { email: "maria.roncallo@demo.local", nombre: "María Roncallo", rol: "comercial", detalle: "Oferta, prospectos e inscripciones", api: false },
  { email: "helena.vargas@demo.local", nombre: "Helena Vargas", rol: "administrativo", detalle: "Roles y complementos del menú", api: false },
];

export type Modulo = { href: string; label: string };

export const MODULOS: Record<RolId, Modulo[]> = {
  estudiante: [
    { href: "/estudiante", label: "Inicio" },
    { href: "/estudiante/academico", label: "Académico" },
    { href: "/estudiante/horario", label: "Horario" },
    { href: "/estudiante/prematricula", label: "Prematrícula" },
    { href: "/estudiante/aula", label: "Aula" },
    { href: "/estudiante/virtual", label: "Campus virtual" },
    { href: "/estudiante/resultados", label: "Resultados" },
    { href: "/estudiante/certificados", label: "Certificados" },
    { href: "/estudiante/pagos", label: "Pagos" },
    { href: "/estudiante/ficha", label: "Mi ficha" },
  ],
  docente: [{ href: "/docente", label: "Mis grupos" }],
  tesoreria: [{ href: "/tesoreria", label: "Cartera" }],
  comercial: [{ href: "/comercial", label: "Oferta y prospectos" }],
  administrativo: [{ href: "/administrativo", label: "Roles y complementos" }],
};

export type Complemento = { id: string; label: string };

export const COMPLEMENTOS: Complemento[] = [
  { id: "notificaciones", label: "Mis notificaciones" },
  { id: "calendario", label: "Calendario académico" },
  { id: "preguntas", label: "Preguntas frecuentes" },
  { id: "contacto", label: "Habla con nosotros" },
  { id: "requisitos", label: "Requisitos técnicos" },
];

const ROLES = Object.keys(ETIQUETA) as RolId[];

export function canonRol(valor: string | null | undefined): RolId {
  const r = (valor ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (r.startsWith("tesor")) return "tesoreria";
  if (r.startsWith("docen") || r === "profesor") return "docente";
  if (r.startsWith("comer") || r.startsWith("asesor")) return "comercial";
  if (r.startsWith("admin")) return "administrativo";
  return (ROLES as string[]).includes(r) ? (r as RolId) : "estudiante";
}

/* ---------- Identidad local (cuentas que no están en la API) ---------- */

export type Local = { nombre: string; rol: RolId; email: string };
const CLAVE_LOCAL = "campus_demo_usuario";

function almacen(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function guardarLocal(valor: Local): void {
  try {
    almacen()?.setItem(CLAVE_LOCAL, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
}

export function leerLocal(): Local | null {
  try {
    const raw = almacen()?.getItem(CLAVE_LOCAL);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Local>;
    if (!v || !v.nombre || !v.rol) return null;
    return { nombre: v.nombre, rol: canonRol(v.rol), email: v.email ?? "" };
  } catch {
    return null;
  }
}

export function borrarLocal(): void {
  try {
    almacen()?.removeItem(CLAVE_LOCAL);
  } catch {
    /* sin almacenamiento */
  }
}

/* ---------- Complementos por rol (se guardan en este navegador) ---------- */

const claveComplementos = (rol: RolId) => `campus_complementos_${rol}`;

export function leerComplementos(rol: RolId): string[] {
  try {
    const raw = almacen()?.getItem(claveComplementos(rol));
    const lista = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function guardarComplementos(rol: RolId, ids: string[]): void {
  try {
    almacen()?.setItem(claveComplementos(rol), JSON.stringify(ids));
  } catch {
    /* sin almacenamiento */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("campus-complementos"));
}

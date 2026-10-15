export class ApiError extends Error {
  status: number;
  codigo?: string;

  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.codigo = codigo;
  }
}

/**
 * Llama a la API de muestra en la misma aplicación (app/v1/[...ruta]/route.ts).
 * La API responde los errores como { error: { codigo, mensaje } }.
 */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store", signal: init.signal ?? control.signal });
  } catch {
    throw new ApiError("La muestra no responde. Recargue la página e intente de nuevo.", 0, "red");
  } finally {
    clearTimeout(espera);
  }

  const texto = await res.text();
  let data: unknown = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }

  if (!res.ok) {
    const err = (data as { error?: { codigo?: string; mensaje?: string } } | null)?.error;
    throw new ApiError(err?.mensaje || `La API respondió ${res.status}.`, res.status, err?.codigo);
  }
  return data as T;
}

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Pesos colombianos sin decimales. Acepta número o texto numérico ("13199940.00"). */
export function cop(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : valor ?? 0;
  return formatoCOP.format(Number.isFinite(n) ? n : 0);
}

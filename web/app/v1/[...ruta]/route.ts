import { NextResponse } from "next/server";
import { despachar } from "@/lib/demo";

// API de muestra: un solo manejador para todas las rutas /v1/* (ver lib/demo.ts).
export const dynamic = "force-dynamic";

type Ctx = { params: { ruta: string[] } };

async function manejar(req: Request, { params }: Ctx) {
  const r = await despachar(req, req.method, params.ruta ?? []);
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

export { manejar as GET, manejar as POST, manejar as PUT, manejar as PATCH, manejar as DELETE };

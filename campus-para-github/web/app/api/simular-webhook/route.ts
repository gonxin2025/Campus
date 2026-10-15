import { NextResponse } from "next/server";
import { capturarPago } from "@/lib/demo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resultado = capturarPago(String(body?.transaccion_id ?? ""));
  return NextResponse.json(resultado.body, { status: resultado.status });
}

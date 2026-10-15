"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, cop } from "@/lib/api";

type Fila = {
  numero: string;
  estudiante: string;
  codigo: string;
  concepto: string;
  saldo: string;
  estado: string;
  vence_en: string;
};

export default function Tesoreria() {
  const [nombre, setNombre] = useState("María López");
  const [filas, setFilas] = useState<Fila[] | null>(null);

  function cargar() {
    api<{ cuentas: Fila[] }>("/v1/cartera").then((d) => setFilas(d.cuentas)).catch(() => undefined);
  }

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    cargar();
  }, []);

  return (
    <Shell nombre={nombre} rol="tesoreria">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Cartera</h1>
        <button className="text-sm underline" onClick={cargar}>
          Actualizar
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        El saldo sale del libro de movimientos. Cuando Ana paga, esta fila pasa a pagada.
      </p>
      <div className="mt-4 grid gap-2">
        {(filas ?? []).map((f) => (
          <article key={f.numero} className="rounded-card border border-line bg-white p-4">
            <p className="text-sm text-muted">{f.numero}</p>
            <p className="text-lg">
              {f.estudiante} · {f.codigo}
            </p>
            <p className="text-sm text-muted">{f.concepto}</p>
            <p className="mt-2 text-2xl">{cop(f.saldo)}</p>
            <p className="text-sm text-muted">
              {f.estado} · vence {f.vence_en}
            </p>
          </article>
        ))}
      </div>
    </Shell>
  );
}

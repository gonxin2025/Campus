"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const FILAS = [
  { evaluacion: "Seguimiento", peso: "70%", nota: "—" },
  { evaluacion: "Cuestionario del módulo", peso: "20%", nota: "—" },
  { evaluacion: "Cierre", peso: "10%", nota: "—" },
];

export default function Resultados() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);
  return (
    <Shell nombre={nombre} rol="estudiante">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Resultados de evaluación</h1>
          <p className="mt-1 text-sm text-muted">Ingeniería de Sistemas · 2026-2 · Carlos Méndez</p>
        </div>
        <p className="text-3xl">—</p>
      </div>
      <p className="mt-2 text-sm text-muted">El parcial de la muestra todavía no está publicado. La tabla muestra los componentes, no una nota inventada.</p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Evaluación</th>
              <th className="px-4 py-3 font-normal">Porcentaje</th>
              <th className="px-4 py-3 font-normal">Nota</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => (
              <tr key={f.evaluacion} className="border-t border-line">
                <td className="px-4 py-3">{f.evaluacion}</td>
                <td className="px-4 py-3">{f.peso}</td>
                <td className="px-4 py-3">{f.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

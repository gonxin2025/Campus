"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const HORAS = [7, 8, 9, 10, 11, 12, 16, 17, 18, 19];

const BLOQUES = [
  { dia: 1, inicio: 16, fin: 18, titulo: "Ingeniería de Sistemas", detalle: "Carlos Méndez · Aula Muestra", tono: "bg-okbg" },
  { dia: 1, inicio: 18, fin: 20, titulo: "Inglés nivel A", detalle: "Aula Muestra", tono: "bg-warnbg" },
  { dia: 3, inicio: 18, fin: 20, titulo: "Inglés nivel C", detalle: "Aula Muestra", tono: "bg-warnbg" },
  { dia: 0, inicio: 18, fin: 20, titulo: "Diplomado IA educación", detalle: "Aula Muestra", tono: "bg-[#E7EEF8]" },
];

export default function Horario() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);

  return (
    <Shell nombre={nombre} rol="estudiante">
      <h1 className="font-serif text-3xl">Horario de clases · 2026-2</h1>
      <p className="mt-1 text-sm text-muted">Ingeniería de Sistemas. Los bloques salen de la oferta de muestra.</p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
        <div className="grid min-w-[880px] grid-cols-[64px_repeat(6,1fr)]">
          <div />
          {DIAS.map((dia) => (
            <div key={dia} className="border-b border-line px-2 py-2 text-sm capitalize text-muted">{dia}</div>
          ))}
          {HORAS.map((hora) => (
            <div key={hora} className="contents">
              <div className="border-t border-line px-2 py-3 text-sm text-muted">{hora}:00</div>
              {DIAS.map((_, dia) => {
                const bloque = BLOQUES.find((b) => b.dia === dia && hora >= b.inicio && hora < b.fin);
                const esInicio = bloque && bloque.inicio === hora;
                return (
                  <div key={`${dia}-${hora}`} className="relative border-l border-t border-line p-1">
                    {esInicio && bloque && (
                      <div className={`rounded-md px-2 py-2 text-xs ${bloque.tono}`} style={{ minHeight: (bloque.fin - bloque.inicio) * 52 }}>
                        <p className="font-medium">{bloque.titulo}</p>
                        <p className="mt-1 text-muted">{bloque.inicio}:00–{bloque.fin}:00</p>
                        <p className="text-muted">{bloque.detalle}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

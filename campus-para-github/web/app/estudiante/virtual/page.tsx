"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const CURSOS = [
  { slug: "ingenieria-de-sistemas", titulo: "Ingeniería de Sistemas", docente: "Carlos Méndez", progreso: 42 },
  { slug: "ingles-a", titulo: "Inglés nivel A", docente: "Por asignar", progreso: 0 },
  { slug: "diplomado-ia-educacion", titulo: "Diplomado en IA generativa para la educación", docente: "Por asignar", progreso: 0 },
];

export default function Virtual() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);
  return (
    <Shell nombre={nombre} rol="estudiante">
      <h1 className="font-serif text-3xl">Cursos virtuales</h1>
      <p className="mt-1 text-sm text-muted">Ingeniería de Sistemas</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {CURSOS.map((curso) => (
          <Link key={curso.slug} href={`/estudiante/virtual/${curso.slug}`} className="rounded-card border border-line bg-white p-4">
            <span className="rounded-full bg-okbg px-2 py-1 text-xs text-ok">{curso.progreso > 0 ? "En progreso" : "Sin iniciar"}</span>
            <p className="mt-4 text-lg">{curso.titulo}</p>
            <div className="mt-3 h-1.5 rounded-full bg-line">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${curso.progreso}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{curso.progreso}% completado</p>
            <p className="text-sm text-muted">Docente: {curso.docente}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const CONTENIDO: Record<string, { titulo: string; objetivo: string }> = {
  "ingenieria-de-sistemas": {
    titulo: "Ingeniería de Sistemas",
    objetivo: "Ubicar el programa, el convenio FUAC y la ruta de matrícula 2026.",
  },
  "ingles-a": {
    titulo: "Inglés nivel A",
    objetivo: "Reconocer el primer nivel de inglés ofertado por CORPADEIN.",
  },
  "diplomado-ia-educacion": {
    titulo: "Diplomado en IA generativa para la educación",
    objetivo: "Identificar el alcance del diplomado publicado por la corporación.",
  },
};

export default function CursoVirtual() {
  const params = useParams<{ curso: string }>();
  const curso = CONTENIDO[params.curso] ?? CONTENIDO["ingenieria-de-sistemas"];
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [recurso, setRecurso] = useState<"texto" | "cuestionario">("texto");
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);

  return (
    <Shell nombre={nombre} rol="estudiante">
      <Link href="/estudiante/virtual" className="text-sm text-muted underline">Cursos virtuales</Link>
      <h1 className="mt-2 font-serif text-3xl">{curso.titulo}</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-card border border-line bg-white p-3 text-sm">
          <p className="text-muted">Módulo 1</p>
          <button className="mt-2 block text-left" onClick={() => setRecurso("texto")}>Lectura</button>
          <button className="mt-2 block text-left" onClick={() => setRecurso("cuestionario")}>Cuestionario</button>
        </aside>
        <article className="rounded-card border border-line bg-white p-4">
          {recurso === "texto" ? (
            <>
              <p className="text-lg">Objetivo: {curso.objetivo}</p>
              <p className="mt-3 text-muted">
                Este recurso es de la muestra. El contenido largo del curso no se copia desde otras plataformas.
              </p>
            </>
          ) : (
            <Link href={`/estudiante/virtual/${params.curso}/cuestionario`} className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white">
              Abrir cuestionario
            </Link>
          )}
        </article>
      </div>
    </Shell>
  );
}

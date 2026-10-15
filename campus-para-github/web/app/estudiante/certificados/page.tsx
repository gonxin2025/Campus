"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

export default function Certificados() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);
  return (
    <Shell nombre={nombre} rol="estudiante">
      <h1 className="font-serif text-3xl">Certificados</h1>
      <p className="mt-2 max-w-2xl text-muted">
        El título se habilita al culminar el programa. En esta muestra Ingeniería de Sistemas sigue en curso, así que el certificado permanece cerrado.
      </p>
      <article className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
        <div>
          <p>Ingeniería de Sistemas</p>
          <p className="text-sm text-muted">CORPADEIN · convenio FUAC · SNIES 1775</p>
        </div>
        <span className="rounded-full bg-warnbg px-3 py-1 text-sm text-warn">En curso</span>
      </article>
      <h2 className="mt-8 text-sm text-muted">Otras constancias</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <article className="rounded-card border border-line bg-white p-4">
          <p>Inducción institucional</p>
          <p className="mt-1 text-sm text-muted">Constancia de muestra · 2026-2</p>
        </article>
        <article className="rounded-card border border-line bg-white p-4 opacity-70">
          <p>Diplomado en IA generativa para la educación</p>
          <p className="mt-1 text-sm text-muted">Se abre al completar el diplomado</p>
        </article>
      </div>
    </Shell>
  );
}

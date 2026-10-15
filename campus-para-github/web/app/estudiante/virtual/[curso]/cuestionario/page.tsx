"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const PREGUNTAS = [
  {
    texto: "¿Cuál es el programa de pregrado que CORPADEIN ofrece en convenio con FUAC?",
    opciones: ["Ingeniería de Sistemas", "Administración de Empresas", "Medicina"],
    correcta: 0,
  },
  {
    texto: "El valor 2026 de referencia de ese pregrado, publicado vía Corpy, está expresado en",
    opciones: ["24 cuotas", "Un solo pago sin referencia", "Dólares"],
    correcta: 0,
  },
];

export default function Cuestionario() {
  const params = useParams<{ curso: string }>();
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [respuestas, setRespuestas] = useState<number[]>([-1, -1]);
  const [enviado, setEnviado] = useState(false);
  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);
  const aciertos = respuestas.filter((r, i) => r === PREGUNTAS[i].correcta).length;

  return (
    <Shell nombre={nombre} rol="estudiante">
      <h1 className="font-serif text-3xl">Cuestionario — Módulo 1</h1>
      {!enviado ? (
        <form
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (respuestas.some((r) => r < 0)) return;
            setEnviado(true);
          }}
        >
          {PREGUNTAS.map((p, i) => (
            <fieldset key={p.texto} className="rounded-card border border-line bg-white p-4">
              <legend className="text-sm text-muted">Pregunta {i + 1}</legend>
              <p className="mt-2">{p.texto}</p>
              <div className="mt-3 grid gap-2">
                {p.opciones.map((op, j) => (
                  <label key={op} className="flex min-h-11 items-center gap-2">
                    <input type="radio" name={`p${i}`} checked={respuestas[i] === j} onChange={() => setRespuestas((cur) => cur.map((v, k) => (k === i ? j : v)))} />
                    {op}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button className="inline-flex min-h-11 w-fit items-center rounded-md bg-accent px-4 text-white">Enviar</button>
        </form>
      ) : (
        <article className="mt-4 rounded-card border border-line bg-white p-6 text-center">
          <p>{nombre}</p>
          <p className="mt-4 text-2xl">{aciertos} / {PREGUNTAS.length}</p>
          <p className="mt-1 text-ok">{aciertos === PREGUNTAS.length ? "Aprobado" : "Pendiente de repaso"}</p>
          <Link href={`/estudiante/virtual/${params.curso}`} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white">
            Volver al curso
          </Link>
        </article>
      )}
    </Shell>
  );
}

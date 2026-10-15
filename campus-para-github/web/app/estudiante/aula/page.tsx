"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

type Tarea = {
  id: string;
  asignatura: string;
  titulo: string;
  cierra_en: string;
  entrega_id: string | null;
  entregada_en: string | null;
};

type Aula = {
  clase: null | { asignatura: string; aula: string; inicio: string; fin: string };
  tareas: Tarea[];
};

export default function AulaPage() {
  const [aula, setAula] = useState<Aula | null>(null);
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [enviando, setEnviando] = useState("");
  const [deshacer, setDeshacer] = useState("");

  function cargar() {
    return api<Aula>("/v1/aula").then(setAula);
  }

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    cargar().catch(() => undefined);
  }, []);

  async function entregar(id: string) {
    setEnviando(id);
    try {
      const res = await api<{ entrega_id: string }>("/v1/tareas/" + id + "/entregar", { method: "POST" });
      setDeshacer(res.entrega_id);
      window.setTimeout(() => setDeshacer((cur) => (cur === res.entrega_id ? "" : cur)), 8000);
      await cargar();
    } finally {
      setEnviando("");
    }
  }

  async function retirar(id: string) {
    await api("/v1/entregas/" + id, { method: "DELETE" });
    setDeshacer("");
    await cargar();
  }

  if (!aula) return <p className="px-4 pt-8 text-muted">Cargando…</p>;
  return (
    <Shell nombre={nombre} rol="estudiante">
      <h1 className="font-serif text-3xl">Aula</h1>
      {aula.clase && (
        <p className="mt-2 text-muted">
          {aula.clase.asignatura} · {aula.clase.inicio}–{aula.clase.fin} · {aula.clase.aula}
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {aula.tareas.length === 0 && <p className="text-muted">No tienes tareas abiertas en las materias en curso.</p>}
        {aula.tareas.map((t) => (
          <article key={t.id} className="rounded-card border border-line bg-white p-4">
            <p className="text-sm text-muted">{t.asignatura}</p>
            <p className="text-lg">{t.titulo}</p>
            {t.entrega_id ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full bg-okbg px-3 py-1 text-sm text-ok">Entregada · {t.entregada_en}</span>
                {deshacer === t.entrega_id && (
                  <button className="text-sm underline" onClick={() => retirar(t.entrega_id!)}>
                    Deshacer
                  </button>
                )}
              </div>
            ) : (
              <button
                className="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white disabled:opacity-50"
                disabled={enviando === t.id}
                onClick={() => entregar(t.id)}
              >
                {enviando === t.id ? "Enviando" : "Entregar"}
              </button>
            )}
          </article>
        ))}
      </div>
    </Shell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

type Grupo = { id: string; nombre: string; codigo: string; estudiantes: number };
type Est = {
  codigo: string;
  nombre: string;
  matricula_id: string;
  asistencia_id: string | null;
  presente: boolean | null;
  nota: string | null;
  publicada: boolean;
};

export default function Docente() {
  const [nombre, setNombre] = useState("Carlos Méndez");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [activo, setActivo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [estudiantes, setEstudiantes] = useState<Est[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState("");

  async function abrir(id: string) {
    setActivo(id);
    const d = await api<{ nombre: string; fecha: string; estudiantes: Est[] }>("/v1/docente/grupos/" + id);
    setTitulo(d.nombre);
    setFecha(d.fecha);
    setEstudiantes(d.estudiantes);
    const mapa: Record<string, string> = {};
    d.estudiantes.forEach((e) => {
      if (e.nota) mapa[e.matricula_id] = e.nota;
    });
    setNotas(mapa);
  }

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    api<{ grupos: Grupo[] }>("/v1/docente/grupos")
      .then((d) => {
        setGrupos(d.grupos);
        const conGente = d.grupos.find((g) => g.estudiantes > 0);
        if (conGente) return abrir(conGente.id);
      })
      .catch(() => undefined);
  }, []);

  async function pasarLista() {
    const d = await api<{ nombre: string; fecha: string; estudiantes: Est[] }>(
      "/v1/docente/grupos/" + activo + "/asistencia",
      { method: "POST" },
    );
    setTitulo(d.nombre);
    setFecha(d.fecha);
    setEstudiantes(d.estudiantes);
  }

  async function toggle(est: Est) {
    if (!est.asistencia_id) return;
    await api("/v1/docente/asistencia/" + est.asistencia_id, {
      method: "PATCH",
      body: JSON.stringify({ presente: !est.presente }),
    });
    await abrir(activo);
  }

  async function guardar() {
    setMensaje("");
    const items = estudiantes
      .filter((e) => notas[e.matricula_id] !== undefined && notas[e.matricula_id] !== "")
      .map((e) => ({ matricula_id: e.matricula_id, nota: Number(notas[e.matricula_id]) }));
    try {
      const d = await api<{ estudiantes: Est[] }>("/v1/docente/grupos/" + activo + "/notas", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      setEstudiantes(d.estudiantes);
      setMensaje("Notas guardadas. Publicar las deja visibles.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudieron guardar.");
    }
  }

  async function publicar() {
    const res = await api<{ publicadas: number }>("/v1/docente/grupos/" + activo + "/publicar", { method: "POST" });
    setMensaje(`Publicadas: ${res.publicadas}. En producción este paso pide MFA.`);
    await abrir(activo);
  }

  return (
    <Shell nombre={nombre} rol="docente">
      <h1 className="font-serif text-3xl">Grupos</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {grupos.map((g) => (
          <button
            key={g.id}
            onClick={() => abrir(g.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${
              activo === g.id ? "bg-accent text-white" : "bg-white ring-1 ring-line"
            }`}
          >
            {g.nombre} · {g.estudiantes}
          </button>
        ))}
      </div>
      {titulo && (
        <section className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg">{titulo}</p>
              <p className="text-sm text-muted">Asistencia {fecha}</p>
            </div>
            <button className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white" onClick={pasarLista}>
              Pasar lista
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {estudiantes.length === 0 && <p className="text-sm text-muted">Sin estudiantes matriculados.</p>}
            {estudiantes.map((e) => (
              <div key={e.matricula_id} className="grid grid-cols-[1fr_auto_5rem] items-center gap-3 rounded-card border border-line bg-white px-3 py-3">
                <div>
                  <p>{e.nombre}</p>
                  <p className="text-sm text-muted">{e.codigo}</p>
                </div>
                <button
                  className="min-h-11 text-sm underline disabled:no-underline disabled:opacity-40"
                  disabled={!e.asistencia_id}
                  onClick={() => toggle(e)}
                >
                  {e.presente === null ? "Sin lista" : e.presente ? "Presente" : "Ausente"}
                </button>
                <input
                  inputMode="decimal"
                  value={notas[e.matricula_id] ?? ""}
                  disabled={e.publicada}
                  onChange={(ev) => setNotas({ ...notas, [e.matricula_id]: ev.target.value })}
                  className="h-11 rounded-md border border-line px-2"
                  placeholder="Nota"
                />
              </div>
            ))}
          </div>
          {estudiantes.length > 0 && (
            <div className="mt-3 flex gap-3">
              <button className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white" onClick={guardar}>
                Guardar notas
              </button>
              <button className="inline-flex min-h-11 items-center px-3 text-sm underline" onClick={publicar}>
                Publicar
              </button>
            </div>
          )}
          {mensaje && <p className="mt-3 text-sm text-muted">{mensaje}</p>}
        </section>
      )}
    </Shell>
  );
}

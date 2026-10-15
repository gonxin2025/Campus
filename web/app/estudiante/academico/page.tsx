"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

type Grupo = {
  grupo_id: string;
  codigo: string;
  asignatura: string;
  horario: string;
  aula: string;
  prerrequisito_ok: boolean;
  faltante?: string;
  seleccionada: boolean;
  conflicto_con?: string;
};

type Plan = { estado: string; grupos: Grupo[] };

export default function Academico() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    api<Plan>("/v1/prematricula").then(setPlan).catch((e: Error) => setMensaje(e.message));
  }, []);

  async function matricular(grupo: Grupo) {
    if (!plan) return;
    const ids = plan.grupos.filter((g) => g.seleccionada || g.grupo_id === grupo.grupo_id).map((g) => g.grupo_id);
    setMensaje("");
    try {
      setPlan(await api<Plan>("/v1/prematricula/seleccion", { method: "PUT", body: JSON.stringify({ grupo_ids: ids }) }));
      setAbierto(false);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo matricular.");
    }
  }

  return (
    <Shell nombre={nombre} rol="estudiante">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Información académica</h1>
          <p className="mt-1 text-sm text-muted">Fecha de matrícula: 13/10/2026 · Periodo 2026-2 · Formalizada: {plan?.estado === "confirmada" ? "Sí" : "En borrador"}</p>
        </div>
        <button onClick={() => setAbierto(true)} className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white">
          Matricular curso
        </button>
      </div>
      {mensaje && <p className="mt-3 rounded-card bg-dangerbg px-3 py-2 text-sm text-danger">{mensaje}</p>}
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Nivel</th>
              <th className="px-4 py-3 font-normal">Estado</th>
              <th className="px-4 py-3 font-normal">Descripción</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-4 py-3">Ingeniería de Sistemas</td>
              <td className="px-4 py-3"><span className="rounded-full bg-okbg px-2 py-1 text-ok">En curso</span></td>
              <td className="px-4 py-3">Grupo A · mar 16:00–18:00</td>
            </tr>
            {plan?.grupos.filter((g) => g.seleccionada).map((g) => (
              <tr key={g.grupo_id} className="border-t border-line">
                <td className="px-4 py-3">{g.asignatura}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 ${plan.estado === "confirmada" ? "bg-okbg text-ok" : "bg-warnbg text-warn"}`}>
                    {plan.estado === "confirmada" ? "Confirmada" : "Pendiente"}
                  </span>
                </td>
                <td className="px-4 py-3">{g.codigo} · {g.horario} · {g.aula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {abierto && plan && (
        <div className="fixed inset-0 z-10 grid place-items-end bg-ink/30 p-4 sm:place-items-center">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-card bg-white p-4">
            <h2 className="text-lg">Matricular curso</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 font-normal">Curso</th>
                  <th className="py-2 font-normal">Horario</th>
                  <th className="py-2 font-normal">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plan.grupos.map((g) => (
                  <tr key={g.grupo_id} className="border-t border-line">
                    <td className="py-3 pr-3">{g.asignatura}</td>
                    <td className="py-3 pr-3">{g.horario} · {g.aula}</td>
                    <td className="py-3">
                      {g.seleccionada ? (
                        <span className="text-ok">En el plan</span>
                      ) : (
                        <button className="underline" disabled={!g.prerrequisito_ok} onClick={() => matricular(g)}>
                          {g.prerrequisito_ok ? "Matricular" : g.faltante || "No disponible"}
                        </button>
                      )}
                      {g.conflicto_con && <p className="text-danger">Cruce con {g.conflicto_con}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="mt-4 min-h-11 text-sm text-muted" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

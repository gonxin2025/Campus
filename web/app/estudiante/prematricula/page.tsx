"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, cop } from "@/lib/api";

type Grupo = {
  grupo_id: string;
  codigo: string;
  asignatura: string;
  creditos: number;
  aula: string;
  horario: string;
  prerrequisito_ok: boolean;
  faltante?: string;
  seleccionada: boolean;
  conflicto_con?: string;
};

type Plan = {
  estado: string;
  grupos: Grupo[];
  creditos_seleccionados: number;
  conflictos: number;
  estimado: { monto: string; moneda: string };
};

export default function Prematricula() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [acepta, setAcepta] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const data = await api<Plan>("/v1/prematricula");
    setPlan(data);
    if (data.estado === "confirmada") setPaso(3);
  }

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    cargar().catch((e: Error) => setMensaje(e.message));
  }, []);

  async function toggle(grupo: Grupo) {
    if (!plan || plan.estado === "confirmada" || !grupo.prerrequisito_ok) return;
    const ids = plan.grupos
      .filter((g) => (g.grupo_id === grupo.grupo_id ? !g.seleccionada : g.seleccionada))
      .map((g) => g.grupo_id);
    setGuardando(true);
    setMensaje("");
    try {
      setPlan(await api<Plan>("/v1/prematricula/seleccion", { method: "PUT", body: JSON.stringify({ grupo_ids: ids }) }));
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmar() {
    setGuardando(true);
    setMensaje("");
    try {
      await api("/v1/prematricula/confirmar", {
        method: "POST",
        body: JSON.stringify({ acepta_reglamento: true }),
      });
      await cargar();
      setPaso(3);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo confirmar.");
    } finally {
      setGuardando(false);
    }
  }

  if (!plan) return <p className="px-4 pt-8 text-muted">Cargando…</p>;

  return (
    <Shell nombre={nombre} rol="estudiante">
      <p className="text-sm text-muted">Paso {paso} de 3</p>
      <h1 className="font-serif text-3xl">Prematrícula 2026-2</h1>
      {mensaje && <p className="mt-3 rounded-card bg-dangerbg px-3 py-2 text-sm text-danger">{mensaje}</p>}

      {paso === 1 && (
        <div className="mt-4 grid gap-2">
          {plan.grupos.map((g) => (
            <label
              key={g.grupo_id}
              className={`block rounded-card border bg-white px-4 py-3 ${g.conflicto_con ? "border-danger" : "border-line"}`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={g.seleccionada}
                  disabled={!g.prerrequisito_ok || plan.estado === "confirmada" || guardando}
                  onChange={() => toggle(g)}
                />
                <span>
                  <span className="block">{g.asignatura}</span>
                  <span className="block text-sm text-muted">
                    {g.horario || "Sin horario publicado"} · espacio de muestra {g.aula}
                  </span>
                  {!g.prerrequisito_ok && (
                    <span className="block text-sm text-danger">Falta prerrequisito: {g.faltante}</span>
                  )}
                  {g.conflicto_con && (
                    <span className="block text-sm text-danger">Se cruza con {g.conflicto_con}</span>
                  )}
                </span>
              </span>
            </label>
          ))}
          <p className="text-sm text-muted">{plan.grupos.filter((g) => g.seleccionada).length} ofertas seleccionadas. Los horarios semanales son de esta muestra.</p>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-white disabled:opacity-50"
            disabled={plan.creditos_seleccionados === 0 || plan.conflictos > 0}
            onClick={() => setPaso(2)}
          >
            Revisar plan
          </button>
        </div>
      )}

      {paso === 2 && (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <ul className="grid gap-2">
            {plan.grupos
              .filter((g) => g.seleccionada)
              .map((g) => (
                <li key={g.grupo_id}>
                  {g.asignatura}
                  <span className="text-muted"> · {g.horario}</span>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Referencia 2026 de Corpy para Ingeniería de Sistemas: {cop(plan.estimado.monto)} en 24 cuotas. No es una liquidación confirmada.
          </p>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
            Acepto el reglamento académico de este periodo.
          </label>
          <div className="mt-4 flex gap-3">
            <button className="min-h-11 px-3 text-sm underline" onClick={() => setPaso(1)}>
              Volver
            </button>
            <button
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white disabled:opacity-50"
              disabled={!acepta || guardando || plan.conflictos > 0}
              onClick={confirmar}
            >
              {guardando ? "Confirmando" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="mt-4 rounded-card border border-line bg-okbg p-4 text-ok">
          <p className="text-lg">Prematrícula confirmada</p>
          <p className="mt-1 text-sm">Las materias quedaron en estado confirmada. El saldo sigue en Pagos.</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white" href="/estudiante/pagos">
            Ir a pagar
          </Link>
        </div>
      )}
    </Shell>
  );
}

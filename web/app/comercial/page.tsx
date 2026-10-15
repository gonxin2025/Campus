"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";

type Etapa = "Prospecto" | "En negociación" | "Cierre" | "Finalizar";
const ETAPAS: Etapa[] = ["Prospecto", "En negociación", "Cierre", "Finalizar"];

type Actividad = { canal: "WhatsApp" | "Llamada"; texto: string; cuando: string };

const INICIAL: Actividad[] = [
  { canal: "WhatsApp", texto: "Confirmó interés en Ingeniería de Sistemas.", cuando: "Hace 3 días" },
  { canal: "Llamada", texto: "Seguimiento telefónico.", cuando: "Hace 5 días" },
];

export default function Comercial() {
  const [etapa, setEtapa] = useState<Etapa>("En negociación");
  const [actividades, setActividades] = useState(INICIAL);
  const [completar, setCompletar] = useState(false);
  const [cerrar, setCerrar] = useState(false);
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("Confirmó que quiere continuar con Ingeniería de Sistemas.");
  const [cierre, setCierre] = useState<"Matriculado" | "Desistió" | "">("");

  function guardarActividad() {
    setActividades((cur) => [{ canal: "WhatsApp", texto: nota, cuando: "Ahora" }, ...cur]);
    setResultado("Actividad registrada");
    setCompletar(false);
    if (etapa === "Prospecto") setEtapa("En negociación");
  }

  return (
    <Shell nombre="María Roncallo" rol="comercial">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-card border border-line bg-white p-3">
          <p className="text-sm text-muted">Oportunidad</p>
          <p className="mt-2">Laura Gómez</p>
          <p className="text-sm text-muted">Interesada en Ingeniería de Sistemas</p>
        </aside>
        <section>
          <h1 className="font-serif text-3xl">Laura Gómez</h1>
          <dl className="mt-4 grid gap-3 rounded-card border border-line bg-white p-4 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Programa</dt><dd>Ingeniería de Sistemas</dd></div>
            <div><dt className="text-sm text-muted">Medio de contacto</dt><dd>WhatsApp</dd></div>
            <div><dt className="text-sm text-muted">Asesor</dt><dd>María Roncallo</dd></div>
          </dl>
          <div className="mt-4 rounded-card border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p>Primer negocio</p>
              {etapa !== "Finalizar" && (
                <button className="text-sm underline" onClick={() => setCerrar(true)}>Finalizar</button>
              )}
            </div>
            <ol className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {ETAPAS.map((item, i) => {
                const hecho = ETAPAS.indexOf(etapa) >= i;
                return (
                  <li key={item}>
                    <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] ${hecho ? "bg-accent text-white" : "bg-line text-muted"}`}>{hecho ? "✓" : i + 1}</span>
                    <p className="mt-2">{item}</p>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div><dt className="text-muted">Fecha tentativa</dt><dd>30/10/2026</dd></div>
              <div><dt className="text-muted">Programa</dt><dd>Ingeniería de Sistemas</dd></div>
              <div><dt className="text-muted">Decisión</dt><dd>Muy decidida</dd></div>
            </dl>
            {cierre && <p className="mt-3 text-sm">Cierre de muestra: {cierre}. No crea una ficha real.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <h2>Actividades</h2>
            <button className="text-sm underline" onClick={() => setCompletar(true)}>Completar actividad</button>
          </div>
          {resultado && <p className="mt-2 text-sm text-ok">{resultado}</p>}
          <div className="mt-3 grid gap-2">
            {actividades.map((a) => (
              <article key={a.texto + a.cuando} className="rounded-card border border-line bg-white p-3">
                <p className="text-sm text-muted">{a.canal} · {a.cuando}</p>
                <p className="mt-1">{a.texto}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
      {completar && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-ink/30 p-4">
          <form
            className="w-full max-w-md rounded-card bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardarActividad();
            }}
          >
            <h2 className="text-lg">Completar actividad</h2>
            <label className="mt-3 block text-sm text-muted">Resultado</label>
            <textarea className="mt-1 w-full rounded-md border border-line p-2" value={nota} onChange={(e) => setNota(e.target.value)} />
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setCompletar(false)}>Cancelar</button>
              <button className="rounded-md bg-accent px-4 py-2 text-white" type="submit">Aceptar</button>
            </div>
          </form>
        </div>
      )}
      {cerrar && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-ink/30 p-4">
          <div className="w-full max-w-lg rounded-card bg-white p-4">
            <h2 className="text-lg">Finalizar oportunidad</h2>
            <p className="mt-1 text-sm text-muted">¿Cómo termina el proceso de Laura?</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button className="rounded-card border border-ok p-4 text-left" onClick={() => { setCierre("Matriculado"); setEtapa("Finalizar"); setCerrar(false); }}>
                <p>Matriculado</p>
                <p className="text-sm text-muted">Sigue hacia la ficha. En la muestra no se crea el estudiante.</p>
              </button>
              <button className="rounded-card border border-danger p-4 text-left" onClick={() => { setCierre("Desistió"); setEtapa("Finalizar"); setCerrar(false); }}>
                <p>Desistió</p>
                <p className="text-sm text-muted">No continuó el proceso.</p>
              </button>
            </div>
            <button className="mt-4 text-sm" onClick={() => setCerrar(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

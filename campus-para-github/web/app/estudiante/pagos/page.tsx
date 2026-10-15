"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, cop } from "@/lib/api";

type Cuenta = {
  cuenta_id: string;
  concepto: string;
  numero: string;
  saldo: string;
  estado: string;
  vence_en: string;
  severidad: string;
};

export default function Pagos() {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [fase, setFase] = useState("");
  const [recibo, setRecibo] = useState("");
  const [error, setError] = useState("");

  function cargar() {
    return api<{ cuentas: Cuenta[] }>("/v1/cuentas").then((d) => setCuentas(d.cuentas));
  }

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
    cargar().catch(() => undefined);
  }, []);

  async function pagar(cuenta: Cuenta) {
    setError("");
    setRecibo("");
    const storageKey = "campus-pay-" + cuenta.cuenta_id;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    setFase("procesando");
    try {
      const intento = await api<{ transaccion_id: string; estado: string }>("/v1/pagos/intenciones", {
        method: "POST",
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ cuenta_id: cuenta.cuenta_id }),
      });
      const webhook = await fetch("/api/simular-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaccion_id: intento.transaccion_id }),
      });
      const data = await webhook.json();
      if (!webhook.ok) throw new Error(data?.error?.mensaje || "El webhook rechazó el pago.");
      setRecibo(data.recibo || intento.transaccion_id);
      setFase("capturado");
      await cargar();
    } catch (e) {
      setFase("");
      setError(e instanceof Error ? e.message : "No se pudo pagar.");
    }
  }

  if (!cuentas) return <p className="px-4 pt-8 text-muted">Cargando…</p>;
  const pendiente = cuentas.find((c) => c.estado !== "pagada");
  const alDia = !pendiente;
  const cuotas = [
    { n: "1 de 24", vence: "16/09/2026", valor: 550000, estado: "Pagada" },
    { n: "2 de 24", vence: "16/10/2026", valor: 550000, estado: alDia ? "Pagada" : "Vencida" },
    { n: "3 de 24", vence: "16/11/2026", valor: 550000, estado: "Por vencer" },
    { n: "4 de 24", vence: "16/12/2026", valor: 550000, estado: "Por vencer" },
    { n: "5 de 24", vence: "16/01/2027", valor: 549940, estado: "Por vencer" },
  ];
  return (
    <Shell nombre={nombre} rol="estudiante">
      <div className={`rounded-card border p-4 ${alDia ? "border-ok/30 bg-okbg text-ok" : "border-danger/20 bg-dangerbg text-danger"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm">{alDia ? "Al día" : "En mora"}</p>
            <p className="mt-1">
              {alDia
                ? "La referencia de la muestra ya no tiene saldo."
                : "La proyección marca la cuota 2 como vencida. El cobro real es el saldo de abajo."}
            </p>
          </div>
          {pendiente && (
            <button
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white disabled:opacity-50"
              disabled={fase === "procesando"}
              onClick={() => pagar(pendiente)}
            >
              {fase === "procesando" ? "Procesando" : "Pagar cuota vencida"}
            </button>
          )}
        </div>
      </div>
      <h1 className="mt-6 font-serif text-3xl">Estado de cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        Proyección de las primeras 5 cuotas sobre $13.199.940 en 24 pagos. No incluye intereses: CORPADEIN no publicó una tasa.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">N.º</th>
              <th className="px-4 py-3 font-normal">Fecha cuota</th>
              <th className="px-4 py-3 font-normal">Total cuota</th>
              <th className="px-4 py-3 font-normal">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => (
              <tr key={c.n} className="border-t border-line">
                <td className="px-4 py-3">{c.n}</td>
                <td className="px-4 py-3">{c.vence}</td>
                <td className="px-4 py-3">{cop(c.valor)}</td>
                <td className={`px-4 py-3 ${c.estado === "Vencida" ? "text-danger" : c.estado === "Pagada" ? "text-ok" : "text-muted"}`}>{c.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 text-lg">Saldo en el libro</h2>
      {error && <p className="mt-3 rounded-card bg-dangerbg px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 grid gap-3">
        {cuentas.map((c) => (
          <article key={c.cuenta_id} className="rounded-card border border-line bg-white p-4">
            <p className="text-sm text-muted">{c.numero}</p>
            <p className="text-lg">{c.concepto}</p>
            <p className="mt-2 text-3xl">{cop(c.saldo)}</p>
            <p className="text-sm text-muted">
              {c.estado} · vence {c.vence_en}
            </p>
            {c.estado === "pagada" || fase === "capturado" ? (
              <p className="mt-3 text-sm text-ok">
                Capturado{recibo ? ` · recibo ${recibo.slice(0, 8)}` : ""}
              </p>
            ) : (
              <button
                className="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-white disabled:opacity-50"
                disabled={fase === "procesando"}
                onClick={() => pagar(c)}
              >
                {fase === "procesando" ? "Procesando" : "Pagar"}
              </button>
            )}
          </article>
        ))}
      </div>
    </Shell>
  );
}

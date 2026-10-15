"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendario } from "@/components/Calendario";
import { Shell } from "@/components/Shell";
import { api, cop } from "@/lib/api";

type Dashboard = {
  estudiante: { codigo: string; nombre: string; programa: string };
  kpis: {
    proxima_clase: null | { asignatura: string; aula: string; inicio: string; fin: string };
  };
  alertas_financieras: Array<{
    concepto: string;
    saldo: string;
    vence_en: string;
    estado: string;
  }>;
};

type Grupo = { grupo_id: string; asignatura: string; horario: string; seleccionada: boolean };
type Plan = { estado: string; grupos: Grupo[] };

const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function diasDeOctubre(semana: number) {
  const dias: number[] = [];
  for (let dia = 1; dia <= 31; dia += 1) {
    if ((2 + dia) % 7 === semana) dias.push(dia);
  }
  return dias;
}

export default function EstudianteHome() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/v1/estudiantes/me/dashboard")
      .then(setData)
      .catch((e: Error) => setError(e.message));
    api<Plan>("/v1/prematricula")
      .then(setPlan)
      .catch(() => undefined);
  }, []);

  if (error) return <p className="px-4 pt-8 text-danger">{error}</p>;
  if (!data) return <p className="px-4 pt-8 text-muted">Cargando…</p>;

  const complementarios = (plan?.grupos ?? []).filter(
    (grupo) => grupo.seleccionada && grupo.asignatura !== "Ingeniería de Sistemas",
  );
  const marcas = new Set<number>(diasDeOctubre(1));
  for (const grupo of complementarios) {
    const prefijo = grupo.horario.slice(0, 3);
    const indice = SEMANA.findIndex((dia) => dia.slice(0, 3) === prefijo);
    if (indice >= 0) diasDeOctubre(indice).forEach((dia) => marcas.add(dia));
  }
  const pendientes = data.alertas_financieras.filter((alerta) => alerta.estado !== "pagada");
  const clase = data.kpis.proxima_clase;
  const estadoPlan = plan?.estado === "confirmada" ? "Confirmada" : "Pendiente";

  return (
    <Shell nombre={data.estudiante.nombre} rol="estudiante">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <section className="overflow-hidden rounded-card border border-line bg-white">
            <h1 className="bg-ink px-4 py-3 text-white">{data.estudiante.programa}</h1>
            <p className="px-4 pt-3 text-sm text-muted">
              Convenio FUAC · SNIES 1775 · {data.estudiante.codigo} · Periodo 2026-2
            </p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="px-4 py-3 font-normal">Curso</th>
                    <th className="px-4 py-3 font-normal">Estado</th>
                    <th className="px-4 py-3 font-normal">Inicio</th>
                    <th className="px-4 py-3 font-normal">Final</th>
                    <th className="px-4 py-3 font-normal">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="px-4 py-3">Ingeniería de Sistemas</td>
                    <td className="px-4 py-3">En curso</td>
                    <td className="px-4 py-3">03/08/2026</td>
                    <td className="px-4 py-3">04/12/2026</td>
                    <td className="px-4 py-3">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-muted">
              Las fechas son las del periodo 2026-2. La nota queda en blanco hasta que exista una definitiva publicada.
            </p>
            {clase && (
              <p className="border-t border-line px-4 py-3 text-sm">
                Próxima clase: {clase.asignatura} · {clase.inicio}–{clase.fin} · Aula {clase.aula}
              </p>
            )}
          </section>

          <section className="mt-4 overflow-hidden rounded-card border border-line bg-white">
            <h2 className="bg-ink px-4 py-3 text-white">Oferta complementaria</h2>
            {complementarios.length === 0 ? (
              <p className="px-4 py-4 text-sm">
                La prematrícula no tiene inglés ni diplomados seleccionados.{" "}
                <Link className="underline" href="/estudiante/academico">
                  Abrir académico
                </Link>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-4 py-3 font-normal">Curso</th>
                      <th className="px-4 py-3 font-normal">Estado</th>
                      <th className="px-4 py-3 font-normal">Inicio</th>
                      <th className="px-4 py-3 font-normal">Final</th>
                      <th className="px-4 py-3 font-normal">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complementarios.map((grupo) => (
                      <tr key={grupo.grupo_id} className="border-t border-line">
                        <td className="px-4 py-3">{grupo.asignatura}</td>
                        <td className="px-4 py-3">{estadoPlan}</td>
                        <td className="px-4 py-3">03/08/2026</td>
                        <td className="px-4 py-3">04/12/2026</td>
                        <td className="px-4 py-3">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-4 overflow-hidden rounded-card border border-line bg-white">
            <h2 className="bg-ink px-4 py-3 text-sm font-medium tracking-wide text-white">Últimas notificaciones</h2>
            {pendientes.length === 0 ? (
              <p className="px-4 py-4 text-sm">No tiene notificaciones nuevas.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pendientes.map((alerta) => (
                  <li key={alerta.concepto} className="px-4 py-3 text-sm">
                    <p>{alerta.concepto}</p>
                    <p className="mt-1 text-muted">
                      {cop(alerta.saldo)} · vence {alerta.vence_en}
                    </p>
                    <Link className="mt-2 inline-flex min-h-11 items-center underline" href="/estudiante/pagos">
                      Ver plan de pagos
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <Calendario marcas={[...marcas]} />
      </div>
    </Shell>
  );
}

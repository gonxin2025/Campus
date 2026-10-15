"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

const TABS = ["Información personal", "Información académica", "Virtualidad", "Información financiera"] as const;

export default function Ficha() {
  const [nombre, setNombre] = useState("Ana Ruiz");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Información personal");

  useEffect(() => {
    api<{ nombre: string }>("/v1/sesion").then((u) => setNombre(u.nombre)).catch(() => undefined);
  }, []);

  return (
    <Shell nombre={nombre} rol="estudiante">
      <p className="text-sm text-muted">Ficha del estudiante</p>
      <h1 className="font-serif text-3xl">{nombre}</h1>
      <p className="mt-1 text-sm text-muted">Ingeniería de Sistemas · DEMO-202612345</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm ${
              tab === item ? "bg-accent text-white" : "bg-white ring-1 ring-line"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Información personal" && (
        <dl className="mt-4 grid gap-3 rounded-card border border-line bg-white p-4 sm:grid-cols-2">
          <Campo k="Nombres" v="Ana" />
          <Campo k="Apellidos" v="Ruiz" />
          <Campo k="Código" v="DEMO-202612345" />
          <Campo k="Correo" v="ana.ruiz@demo.local" />
          <Campo k="Programa" v="Ingeniería de Sistemas" />
          <Campo k="Sede" v="Bogotá" />
        </dl>
      )}
      {tab === "Información académica" && (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <p>Periodo 2026-2. Ingeniería de Sistemas está en curso.</p>
          <Link className="mt-3 inline-flex min-h-11 items-center underline" href="/estudiante/academico">
            Abrir matrícula por nivel
          </Link>
        </div>
      )}
      {tab === "Virtualidad" && (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <p>El aula agrupa módulos, lecturas y el cuestionario del curso en curso.</p>
          <Link className="mt-3 inline-flex min-h-11 items-center underline" href="/estudiante/virtual">
            Abrir cursos virtuales
          </Link>
        </div>
      )}
      {tab === "Información financiera" && (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <p>La referencia 2026 de Ingeniería de Sistemas es $13.199.940 en 24 cuotas. El estado de cuenta muestra esa proyección y el saldo real de la muestra.</p>
          <Link className="mt-3 inline-flex min-h-11 items-center underline" href="/estudiante/pagos">
            Abrir estado de cuenta
          </Link>
        </div>
      )}
    </Shell>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="mt-1">{v}</dd>
    </div>
  );
}

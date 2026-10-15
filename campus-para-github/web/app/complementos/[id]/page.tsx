"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Calendario } from "@/components/Calendario";
import { useIdentidad } from "@/lib/useIdentidad";
import { COMPLEMENTOS } from "@/lib/roles";

const TEXTOS: Record<string, { titulo: string; cuerpo: string }> = {
  notificaciones: {
    titulo: "Mis notificaciones",
    cuerpo: "No tiene notificaciones nuevas.",
  },
  calendario: {
    titulo: "Calendario académico",
    cuerpo: "Periodo 2026-2: del 3 de agosto al 4 de diciembre de 2026. La prematrícula de la muestra está abierta del 1 al 31 de octubre.",
  },
  preguntas: {
    titulo: "Preguntas frecuentes",
    cuerpo: "La clave de la muestra es campus. El pago no sale del equipo. Las sedes publicadas son Bogotá, Chía y Cartagena.",
  },
  contacto: {
    titulo: "Habla con nosotros",
    cuerpo: "Sedes de la muestra: Bogotá, Chía y Cartagena. El mensaje no se envía a un buzón real.",
  },
  requisitos: {
    titulo: "Requisitos técnicos",
    cuerpo: "Basta un navegador actual. La muestra no pide otro programa en el equipo.",
  },
};

export default function Complemento() {
  const params = useParams<{ id: string }>();
  const identidad = useIdentidad();
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const item = COMPLEMENTOS.find((entrada) => entrada.id === params.id);
  const texto = item ? TEXTOS[item.id] : undefined;

  function enviar(event: FormEvent) {
    event.preventDefault();
    setAviso("Quedó en este navegador. No salió de la muestra.");
    setNota("");
  }

  if (!identidad) return <p className="px-4 pt-8 text-muted">Cargando…</p>;

  return (
    <Shell nombre={identidad.nombre} rol={identidad.rol}>
      <h1 className="font-serif text-3xl">{texto?.titulo ?? "Complemento"}</h1>
      <p className="mt-3 max-w-2xl text-muted">{texto?.cuerpo ?? "Ese complemento no está en la muestra."}</p>
      {item?.id === "calendario" && (
        <div className="mt-4 max-w-sm">
          <Calendario marcas={[6, 13, 20, 27]} />
        </div>
      )}
      {item?.id === "contacto" && (
        <form onSubmit={enviar} className="mt-4 grid max-w-lg gap-3">
          <label className="grid gap-1 text-sm">
            Mensaje
            <textarea
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              required
              rows={4}
              className="rounded-md border border-line px-3 py-2"
            />
          </label>
          <button className="inline-flex min-h-11 w-fit items-center rounded-md bg-accent px-4 text-white">Registrar</button>
          {aviso && <p className="text-sm text-muted">{aviso}</p>}
        </form>
      )}
    </Shell>
  );
}

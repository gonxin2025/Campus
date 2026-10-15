"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useIdentidad } from "@/lib/useIdentidad";
import {
  COMPLEMENTOS,
  ETIQUETA,
  MODULOS,
  guardarComplementos,
  leerComplementos,
  type RolId,
} from "@/lib/roles";

const ROLES = Object.keys(ETIQUETA) as RolId[];

export default function Administrativo() {
  const identidad = useIdentidad();
  const [activos, setActivos] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const leer = () => {
      const siguiente: Record<string, string[]> = {};
      for (const rol of ROLES) siguiente[rol] = leerComplementos(rol);
      setActivos(siguiente);
    };
    leer();
    window.addEventListener("campus-complementos", leer);
    return () => window.removeEventListener("campus-complementos", leer);
  }, []);

  function alternar(rol: RolId, id: string) {
    const actuales = activos[rol] ?? [];
    const siguiente = actuales.includes(id) ? actuales.filter((item) => item !== id) : [...actuales, id];
    guardarComplementos(rol, siguiente);
  }

  if (!identidad) return <p className="px-4 pt-8 text-muted">Cargando…</p>;

  return (
    <Shell nombre={identidad.nombre} rol={identidad.rol}>
      <h1 className="font-serif text-3xl">Roles y complementos</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Cada rol abre solo sus módulos. Los complementos se guardan en este navegador y aparecen en el menú de ese perfil.
      </p>
      <div className="mt-4 grid gap-3">
        {ROLES.map((rol) => (
          <article key={rol} className="rounded-card border border-line bg-white p-4">
            <h2 className="text-lg">{ETIQUETA[rol]}</h2>
            <p className="mt-1 text-sm text-muted">{MODULOS[rol].map((item) => item.label).join(" · ")}</p>
            <fieldset className="mt-3 grid gap-1">
              <legend className="text-sm">Complementos</legend>
              {COMPLEMENTOS.map((item) => (
                <label key={item.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(activos[rol] ?? []).includes(item.id)}
                    onChange={() => alternar(rol, item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
          </article>
        ))}
      </div>
    </Shell>
  );
}

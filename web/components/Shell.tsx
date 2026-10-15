"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { COMPLEMENTOS, ETIQUETA, MODULOS, borrarLocal, leerComplementos, type RolId } from "@/lib/roles";

type Props = { nombre: string; rol: RolId; children: ReactNode };

export function Shell({ nombre, rol, children }: Props) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);

  useEffect(() => {
    const leer = () => setExtras(leerComplementos(rol));
    leer();
    window.addEventListener("campus-complementos", leer);
    return () => window.removeEventListener("campus-complementos", leer);
  }, [rol]);

  useEffect(() => setAbierto(false), [ruta]);

  async function salir() {
    await api("/v1/demo/sesion", { method: "DELETE" }).catch(() => undefined);
    borrarLocal();
    window.location.href = "/";
  }

  const modulos = MODULOS[rol] ?? [];
  const complementos = COMPLEMENTOS.filter((c) => extras.includes(c.id));
  const activo = (href: string) => ruta === href || (href !== modulos[0]?.href && ruta?.startsWith(href + "/"));

  const enlace = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      aria-current={activo(href) ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-md px-3 text-sm ${
        activo(href) ? "bg-accent text-white" : "text-ink hover:bg-canvas"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <span className="font-serif text-xl text-accent">CORPADEIN</span>
        <button
          type="button"
          className="min-h-11 rounded-md border border-line px-3 text-sm"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((v) => !v)}
        >
          Menú
        </button>
      </header>

      <aside
        id="menu-principal"
        className={`${abierto ? "block" : "hidden"} border-b border-line bg-white px-3 py-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r`}
      >
        <p className="hidden px-3 font-serif text-2xl text-accent lg:block">CORPADEIN</p>
        <div className="mt-2 flex items-center gap-3 rounded-card bg-canvas px-3 py-3 lg:mt-6">
          <Avatar nombre={nombre} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{nombre}</span>
            <span className="block text-xs text-muted">{ETIQUETA[rol]}</span>
          </span>
        </div>
        <nav aria-label="Módulos" className="mt-4 grid gap-1">
          {modulos.map((m) => enlace(m.href, m.label))}
        </nav>
        {complementos.length > 0 && (
          <nav aria-label="Complementos" className="mt-4 grid gap-1 border-t border-line pt-4">
            <p className="px-3 pb-1 text-xs uppercase tracking-wide text-muted">Complementos</p>
            {complementos.map((c) => enlace(`/complementos/${c.id}`, c.label))}
          </nav>
        )}
        <button
          type="button"
          onClick={salir}
          className="mt-6 flex min-h-11 w-full items-center rounded-md border border-line px-3 text-sm text-muted hover:text-ink"
        >
          Salir
        </button>
        <p className="mt-4 px-3 text-xs text-muted">Muestra local. Personas ficticias; ningún pago sale del equipo.</p>
      </aside>

      <main className="px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

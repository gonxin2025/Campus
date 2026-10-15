"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import {
  CLAVE_MUESTRA,
  CUENTAS,
  DESTINO,
  ETIQUETA,
  borrarLocal,
  canonRol,
  guardarLocal,
  leerLocal,
} from "@/lib/roles";

export default function Entrada() {
  const [email, setEmail] = useState("ana.ruiz@demo.local");
  const [clave, setClave] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ rol: string }>("/v1/sesion")
      .then((u) => {
        window.location.href = DESTINO[canonRol(u.rol)] ?? "/";
      })
      .catch(() => {
        const local = leerLocal();
        if (local) window.location.href = DESTINO[local.rol];
      });
  }, []);

  function usar(cuentaEmail: string) {
    setEmail(cuentaEmail);
    setClave(CLAVE_MUESTRA);
    setError("");
  }

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setError("");
    const cuenta = CUENTAS.find((item) => item.email === email.trim().toLowerCase());
    if (!cuenta) {
      setError("Ese correo no está en la muestra.");
      return;
    }
    if (clave !== CLAVE_MUESTRA) {
      setError("La clave de la muestra es campus.");
      return;
    }
    setOcupado(true);
    try {
      borrarLocal();
      if (cuenta.api) {
        const u = await api<{ rol: string }>("/v1/demo/sesion", {
          method: "POST",
          body: JSON.stringify({ email: cuenta.email }),
        });
        window.location.href = DESTINO[canonRol(u.rol)];
        return;
      }
      await api("/v1/demo/sesion", { method: "DELETE" }).catch(() => undefined);
      guardarLocal({ nombre: cuenta.nombre, rol: cuenta.rol, email: cuenta.email });
      window.location.href = DESTINO[cuenta.rol];
    } catch (e) {
      setOcupado(false);
      setError(e instanceof ApiError ? e.message : "No se pudo entrar.");
    }
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="flex flex-col justify-center bg-accent px-6 py-12 text-white lg:px-12">
        <p className="font-serif text-4xl">CORPADEIN</p>
        <h1 className="mt-8 text-2xl">Ingresar</h1>
        <p className="mt-2 max-w-md text-sm text-white/80">
          Bogotá, Chía y Cartagena. La oferta de esta muestra sale del catálogo publicado. Las personas son ficticias.
        </p>
        <form className="mt-8 grid max-w-sm gap-4" onSubmit={entrar}>
          <label className="grid gap-1 text-sm">
            Correo
            <input
              className="min-h-11 rounded-md border border-white/30 bg-white px-3 text-ink"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Contraseña
            <input
              className="min-h-11 rounded-md border border-white/30 bg-white px-3 text-ink"
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(event) => setClave(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="rounded-md bg-white px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 font-medium text-accent disabled:opacity-60"
            disabled={ocupado}
          >
            {ocupado ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-sm text-white/80">Clave de la muestra: campus</p>
        </form>
      </section>
      <section className="bg-canvas px-6 py-10 lg:px-10">
        <h2 className="font-serif text-3xl">Cuentas de muestra</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Elige un rol. El menú abre solo los módulos de ese perfil. Asesor y administrativo no entran al directorio de la API.
        </p>
        <div className="mt-6 grid gap-3">
          {CUENTAS.map((cuenta) => {
            const seleccionada = email === cuenta.email;
            return (
              <button
                key={cuenta.email}
                type="button"
                onClick={() => usar(cuenta.email)}
                aria-pressed={seleccionada}
                className={`flex items-center gap-3 rounded-card border bg-white px-4 py-3 text-left ${
                  seleccionada ? "border-accent" : "border-line"
                }`}
              >
                <Avatar nombre={cuenta.nombre} size={48} />
                <span>
                  <span className="block text-sm text-muted">{ETIQUETA[cuenta.rol]}</span>
                  <span className="mt-0.5 block text-lg">{cuenta.nombre}</span>
                  <span className="mt-1 block text-sm text-muted">{cuenta.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

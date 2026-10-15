"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { canonRol, leerLocal, type RolId } from "@/lib/roles";

export type Identidad = { nombre: string; rol: RolId; email?: string };

/**
 * Quién está viendo la página: primero la sesión de la API (cookie);
 * si no hay, la cuenta local (asesor o administrativo). Sin ninguna, vuelve al ingreso.
 */
export function useIdentidad(): Identidad | null {
  const [identidad, setIdentidad] = useState<Identidad | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ nombre: string; rol: string; email?: string }>("/v1/sesion")
      .then((u) => {
        if (vivo) setIdentidad({ nombre: u.nombre, rol: canonRol(u.rol), email: u.email });
      })
      .catch(() => {
        const local = leerLocal();
        if (!vivo) return;
        if (local) setIdentidad(local);
        else window.location.href = "/";
      });
    return () => {
      vivo = false;
    };
  }, []);

  return identidad;
}

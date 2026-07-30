// Simulación del sistema de roles mientras no hay Supabase Auth conectado.
// Cuando se conecte Supabase, esto se reemplaza por la sesión real
// (auth.users + tabla `roles`) y por políticas de Row Level Security.

import { useEffect, useState } from "react";
import type { RolUsuario } from "./db";

export type { RolUsuario };

const ROLE_KEY = "inventarioLY25_rolActivo";

export function getRolActivo(): RolUsuario {
  if (typeof window === "undefined") return "admin";
  return (window.localStorage.getItem(ROLE_KEY) as RolUsuario) || "admin";
}

export function setRolActivo(rol: RolUsuario) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROLE_KEY, rol);
  window.dispatchEvent(new Event("rol-changed"));
}

export function useRolActivo() {
  const [rol, setRol] = useState<RolUsuario>("admin");

  useEffect(() => {
    setRol(getRolActivo());
    const onChange = () => setRol(getRolActivo());
    window.addEventListener("rol-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("rol-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return { rol, esAdmin: rol === "admin" };
}

"use client";

// Info de sesión "de vidriera" para el header (nombre), separada del rol
// admin/usuario (lib/role.ts) para no romper lo que ya depende de éste
// último. Cuando se conecte Supabase Auth, esto se reemplaza por el usuario
// real logueado (auth.users + tabla `users`).

import { useEffect, useState } from "react";

const SESSION_KEY = "inventarioLY25_sesionDisplay";

export type SesionDisplay = {
  nombre: string;
  usuarioId?: string;
};

const DEFAULT_SESSION: SesionDisplay = { nombre: "Alex Moreno" };

export function getSesionDisplay(): SesionDisplay {
  if (typeof window === "undefined") return DEFAULT_SESSION;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? { ...DEFAULT_SESSION, ...JSON.parse(raw) } : DEFAULT_SESSION;
}

export function setSesionDisplay(s: Partial<SesionDisplay>) {
  if (typeof window === "undefined") return;
  const merged = { ...getSesionDisplay(), ...s };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event("sesion-changed"));
}

export function useSesionDisplay() {
  const [sesion, setSesion] = useState<SesionDisplay>(DEFAULT_SESSION);

  useEffect(() => {
    setSesion(getSesionDisplay());
    const onChange = () => setSesion(getSesionDisplay());
    window.addEventListener("sesion-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sesion-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return sesion;
}

"use client";

// Info de sesión "de vidriera" para el header (nombre), leída ahora desde
// public.users en Supabase en vez de localStorage.

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type SesionDisplay = {
  nombre: string;
  usuarioId?: string;
};

const SIN_SESION: SesionDisplay = { nombre: "" };

export function useSesionDisplay() {
  const [sesion, setSesion] = useState<SesionDisplay>(SIN_SESION);

  useEffect(() => {
    let activo = true;

    async function cargar(userId: string | undefined) {
      if (!userId) {
        if (activo) setSesion(SIN_SESION);
        return;
      }
      const { data } = await supabase.from("users").select("nombre").eq("id", userId).single();
      if (activo) setSesion({ nombre: data?.nombre || "", usuarioId: userId });
    }

    supabase.auth.getSession().then(({ data }) => cargar(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      cargar(session?.user.id);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return sesion;
}

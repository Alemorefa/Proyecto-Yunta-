"use client";

// Info de sesión "de vidriera" para el header (nombre, email, foto), leída
// desde public.users en Supabase. Se puede forzar una relectura disparando
// el evento "perfil-changed" (lo hace preferencias-dialog.tsx al guardar).

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type SesionDisplay = {
  nombre: string;
  email: string;
  avatarUrl: string | null;
  usuarioId?: string;
};

const SIN_SESION: SesionDisplay = { nombre: "", email: "", avatarUrl: null };

export function useSesionDisplay() {
  const [sesion, setSesion] = useState<SesionDisplay>(SIN_SESION);

  useEffect(() => {
    let activo = true;
    let userIdActual: string | undefined;

    async function cargar(userId: string | undefined) {
      userIdActual = userId;
      if (!userId) {
        if (activo) setSesion(SIN_SESION);
        return;
      }
      const { data } = await supabase.from("users").select("nombre, email, avatar_url").eq("id", userId).single();
      if (activo) {
        setSesion({
          nombre: data?.nombre || "",
          email: data?.email || "",
          avatarUrl: data?.avatar_url || null,
          usuarioId: userId,
        });
      }
    }

    supabase.auth.getSession().then(({ data }) => cargar(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      cargar(session?.user.id);
    });
    const onPerfilChanged = () => cargar(userIdActual);
    window.addEventListener("perfil-changed", onPerfilChanged);

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("perfil-changed", onPerfilChanged);
    };
  }, []);

  return sesion;
}

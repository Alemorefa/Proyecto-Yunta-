"use client";

// Rol activo (admin/usuario), leído ahora desde la tabla public.users de
// Supabase en vez de localStorage. El rol lo asigna el trigger al
// registrarse (primer usuario del proyecto = admin, el resto = usuario), o
// lo puede cambiar un admin más adelante desde Usuarios.

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { RolUsuario } from "./db";

export type { RolUsuario };

export function useRolActivo() {
  const [rol, setRol] = useState<RolUsuario>("usuario");

  useEffect(() => {
    let activo = true;

    async function cargar(userId: string | undefined) {
      if (!userId) {
        if (activo) setRol("usuario");
        return;
      }
      const { data } = await supabase.from("users").select("role_id").eq("id", userId).single();
      if (activo) setRol((data?.role_id as RolUsuario) || "usuario");
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

  return { rol, esAdmin: rol === "admin" };
}

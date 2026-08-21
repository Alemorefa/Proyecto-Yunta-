"use client";

// Autenticación real con Supabase Auth (reemplaza el login local en texto
// plano que tenía el prototipo). Las contraseñas ya no las vemos ni las
// guardamos nosotros: Supabase las hashea y valida del otro lado.
//
// Cuando alguien se registra (signUp), un trigger en la base de datos
// (ver supabase/schema.sql → handle_new_user) crea automáticamente su fila
// en public.users: la primera persona que se registra en todo el proyecto
// queda como "admin", el resto entra como "usuario" (un admin la puede
// ascender después).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type ResultadoLogin = { ok: true } | { ok: false; error: string };

export function useAutenticado() {
  // null = todavía no se leyó la sesión (evita el flash de login en el
  // primer render).
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;

    // Además de "¿hay sesión?", chequeamos que la cuenta siga activa en
    // public.users. Si un admin la desactivó, la echamos acá aunque la
    // sesión del navegador siga técnicamente válida.
    async function evaluar(session: Session | null) {
      if (!session) {
        if (vivo) setAuth(false);
        return;
      }
      const { data } = await supabase.from("users").select("activo").eq("id", session.user.id).single();
      if (!vivo) return;
      if (data && data.activo === false) {
        await supabase.auth.signOut();
        toast.error("Tu cuenta fue desactivada. Consultá con un administrador.");
        setAuth(false);
        return;
      }
      setAuth(true);
    }

    supabase.auth.getSession().then(({ data }) => evaluar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      evaluar(session);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return auth;
}

function traducirError(mensaje: string): string {
  if (mensaje.includes("Invalid login credentials")) return "Email o contraseña incorrectos";
  if (mensaje.includes("User already registered")) return "Ya existe una cuenta con ese email";
  if (mensaje.includes("Password should be at least")) return "La contraseña necesita al menos 6 caracteres";
  if (mensaje.includes("Unable to validate email address")) return "Ese email no es válido";
  return mensaje;
}

export async function iniciarSesion(email: string, contrasena: string): Promise<ResultadoLogin> {
  if (!email.trim() || !contrasena) return { ok: false, error: "Completá email y contraseña" };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: contrasena,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true };
}

// Manda un email con un link para elegir una contraseña nueva (a diferencia
// del prototipo anterior, ahora sí hay verificación real: solo quien tiene
// acceso a esa casilla de correo puede resetear la contraseña).
export async function recuperarContrasena(email: string): Promise<ResultadoLogin> {
  if (!email.trim()) return { ok: false, error: "Completá tu email" };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/recuperar-contrasena` : undefined,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true };
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

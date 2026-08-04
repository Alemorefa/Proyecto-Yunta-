"use client";

// Preferencias del propio usuario: nombre, foto y cambio de contraseña.
// A diferencia de lib/usuarios-data.ts (que un ADMIN usa para gestionar a
// otros), esto lo usa cualquier persona logueada sobre su propia cuenta —
// permitido por la policy "editar_propio_perfil" de public.users.

import { supabase } from "./supabase";

export type PerfilInput = {
  nombre: string;
  avatar_url: string | null;
};

export async function actualizarMiPerfil(userId: string, input: PerfilInput): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ nombre: input.nombre.trim(), avatar_url: input.avatar_url })
    .eq("id", userId);
  if (error) throw error;
  window.dispatchEvent(new Event("perfil-changed"));
}

// Pide la contraseña actual y reautentica antes de cambiarla — así no
// alcanza con tener la sesión abierta (por ej. el celular desbloqueado) para
// cambiarle la contraseña a otra persona.
export async function cambiarMiContrasena(email: string, actual: string, nueva: string): Promise<void> {
  const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password: actual });
  if (errorLogin) throw new Error("La contraseña actual no es correcta");

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw error;
}

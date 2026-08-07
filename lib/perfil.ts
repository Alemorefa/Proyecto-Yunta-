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

  // Cierra cualquier OTRA sesión activa de esta cuenta (otro navegador, otro
  // celular, o un token robado) sin tocar la sesión actual. Recomendado en
  // la auditoría del 2026-08-05: como el token vive en localStorage y no en
  // una cookie httpOnly, esto limita cuánto puede durar un token robado si
  // en algún momento se filtra.
  await supabase.auth.signOut({ scope: "others" });
}

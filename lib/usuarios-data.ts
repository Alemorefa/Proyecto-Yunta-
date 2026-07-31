"use client";

// Usuarios reales — perfil en Supabase (tabla public.users), ligado 1:1 a
// la cuenta de Supabase Auth (auth.users) con la que cada persona inicia
// sesión. Las cuentas se crean desde la pantalla de login ("Crear una
// cuenta nueva"); acá un admin solo puede ver la lista, cambiar el rol,
// el teléfono y activar/desactivar.

import { supabase } from "./supabase";
import type { RolUsuario } from "./db";

export type UsuarioReal = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role_id: RolUsuario;
  activo: boolean;
  fecha_creacion: string;
};

export async function listarUsuarios(): Promise<UsuarioReal[]> {
  const { data, error } = await supabase.from("users").select("*").order("nombre");
  if (error) throw error;
  return (data ?? []) as UsuarioReal[];
}

export type UsuarioInput = {
  nombre: string;
  telefono: string;
  role_id: RolUsuario;
};

export async function actualizarUsuario(id: string, input: UsuarioInput): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      nombre: input.nombre.trim(),
      telefono: input.telefono.trim() || null,
      role_id: input.role_id,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cambiarEstadoUsuario(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("users").update({ activo }).eq("id", id);
  if (error) throw error;
}

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
  super_admin: boolean;
  avatar_url?: string | null;
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

export type CrearUsuarioInput = {
  email: string;
  nombre: string;
  telefono: string;
  role_id: RolUsuario;
  contrasena: string;
};

// Da de alta una cuenta nueva con una contraseña que elige el admin en el
// momento (se la pasa a la persona directamente). Solo puede llamarla un
// admin — la validación real ocurre del lado del servidor (app/api/admin/
// crear-usuario), acá solo mandamos el pedido con el token de la sesión
// actual.
export async function crearUsuario(input: CrearUsuarioInput): Promise<void> {
  const { data: sesionData } = await supabase.auth.getSession();
  const token = sesionData.session?.access_token;
  if (!token) throw new Error("No hay una sesión activa");

  const res = await fetch("/api/admin/crear-usuario", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo crear el usuario");
}

// Elimina la cuenta de verdad (no solo la fila de public.users). Solo el
// super admin puede llamarla — la validación real ocurre del lado del
// servidor (app/api/admin/eliminar-usuario).
export async function eliminarUsuario(id: string): Promise<void> {
  const { data: sesionData } = await supabase.auth.getSession();
  const token = sesionData.session?.access_token;
  if (!token) throw new Error("No hay una sesión activa");

  const res = await fetch("/api/admin/eliminar-usuario", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo eliminar el usuario");
}

"use client";

// Historial de movimientos de activos — ahora en Supabase (tabla
// asset_movements) en vez de localStorage.

import { supabase } from "./supabase";
import type { AccionMovimiento } from "./db";

export type Movimiento = {
  id: string;
  asset_id: string;
  fecha: string;
  usuario_id: string | null;
  accion: AccionMovimiento;
  observacion: string | null;
  store_origen_id: string | null;
  store_destino_id: string | null;
  sector_origen_id: string | null;
  sector_destino_id: string | null;
};

export async function listarMovimientos(): Promise<Movimiento[]> {
  const { data, error } = await supabase.from("asset_movements").select("*").order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Movimiento[];
}

export type UsuarioBasico = { id: string; nombre: string };

// Lista mínima de usuarios (id + nombre) para mostrar "quién hizo qué" en
// el historial. Cualquier usuario logueado puede leer esto (no incluye
// email ni nada sensible).
export async function listarUsuariosBasico(): Promise<UsuarioBasico[]> {
  const { data, error } = await supabase.from("users").select("id, nombre");
  if (error) throw error;
  return (data ?? []) as UsuarioBasico[];
}

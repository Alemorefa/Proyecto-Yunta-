"use client";

// Impresoras (recargas y cambios de cartucho) — ahora en Supabase (tablas
// printers y printer_movements) en vez de localStorage.

import { supabase } from "./supabase";
import type { TipoMovimientoImpresora } from "./db";

export type Impresora = {
  id: string;
  modelo: string;
  store_id: string;
  observaciones: string | null;
  fecha_creacion: string;
};

export type MovimientoImpresora = {
  id: string;
  printer_id: string;
  fecha: string; // yyyy-mm-dd
  tipo: TipoMovimientoImpresora;
  observacion: string | null;
  usuario_id: string | null;
};

export async function listarImpresoras(): Promise<Impresora[]> {
  const { data, error } = await supabase.from("printers").select("*").order("fecha_creacion", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Impresora[];
}

export async function crearImpresora(modelo: string, storeId: string): Promise<Impresora> {
  const { data, error } = await supabase
    .from("printers")
    .insert({ modelo: modelo.trim(), store_id: storeId })
    .select()
    .single();
  if (error) throw error;
  return data as Impresora;
}

export async function listarMovimientosImpresora(): Promise<MovimientoImpresora[]> {
  const { data, error } = await supabase
    .from("printer_movements")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MovimientoImpresora[];
}

export type MovimientoImpresoraInput = {
  printer_id: string;
  fecha: string;
  tipo: TipoMovimientoImpresora;
  observacion: string;
  usuario_id: string | null;
};

export async function registrarMovimientoImpresora(input: MovimientoImpresoraInput): Promise<void> {
  const { error } = await supabase.from("printer_movements").insert({
    printer_id: input.printer_id,
    fecha: input.fecha,
    tipo: input.tipo,
    observacion: input.observacion.trim() || null,
    usuario_id: input.usuario_id,
  });
  if (error) throw error;
}

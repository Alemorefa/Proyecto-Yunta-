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
  activa: boolean;
  // Si lleva cartucho de tóner (una térmica de tickets, por ejemplo, no).
  // Solo las que lo llevan tienen medidor y generan avisos de agotado.
  usa_toner: boolean;
  // Días que dura un cartucho EN ESTA impresora (cada modelo rinde distinto).
  // En null no se calcula medidor ni se avisa.
  dias_toner: number | null;
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

export async function crearImpresora(
  modelo: string,
  storeId: string,
  usaToner = true,
  diasToner: number | null = null
): Promise<Impresora> {
  const { data, error } = await supabase
    .from("printers")
    .insert({
      modelo: modelo.trim(),
      store_id: storeId,
      usa_toner: usaToner,
      dias_toner: usaToner ? diasToner : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Impresora;
}

// Cambia si la impresora lleva cartucho o no (se puede corregir después de
// darla de alta, desde Impresoras o desde el activo vinculado en Inventario).
export async function cambiarUsaToner(id: string, usaToner: boolean): Promise<void> {
  const { error } = await supabase.from("printers").update({ usa_toner: usaToner }).eq("id", id);
  if (error) throw error;
}

// Corrige la duración estimada del cartucho de una impresora. Se usa desde el
// diálogo de registrar movimiento: al cargar una recarga es cuando se nota
// que ese modelo rinde más o menos de lo estimado.
export async function cambiarDiasToner(id: string, dias: number | null): Promise<void> {
  const { error } = await supabase.from("printers").update({ dias_toner: dias }).eq("id", id);
  if (error) throw error;
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

// Renombra el modelo de una impresora (mover de tienda es una acción aparte,
// ver moverImpresoraDeTienda más abajo, porque esa además deja un registro
// de "Transferencia" en el historial).
export async function editarImpresora(id: string, modelo: string): Promise<void> {
  const { error } = await supabase.from("printers").update({ modelo: modelo.trim() }).eq("id", id);
  if (error) throw error;
}

// Dar de baja / reactivar una impresora. Solo cambia el flag "activa" — no
// toca ni borra los movimientos ya registrados (quedan intactos en el
// historial, tal cual se cargaron).
export async function cambiarEstadoImpresora(id: string, activa: boolean): Promise<void> {
  const { error } = await supabase.from("printers").update({ activa }).eq("id", id);
  if (error) throw error;
}

// Mueve una impresora a otra tienda. Los movimientos anteriores no se
// tocan: siguen apuntando a la misma impresora, y la tienda que muestran en
// el historial se resuelve con la tienda ACTUAL de la impresora al momento
// de mostrarlos (igual que antes de este cambio).
export async function moverImpresoraDeTienda(id: string, storeId: string): Promise<void> {
  const { error } = await supabase.from("printers").update({ store_id: storeId }).eq("id", id);
  if (error) throw error;
}

"use client";

// Configuración general del negocio (nombre + cotización del dólar) —
// ahora en Supabase (tabla settings, fila única id=1) en vez de
// localStorage. exchange_rates guarda el historial de cada vez que se
// trae la cotización oficial desde DolarApi.com.

import { supabase } from "./supabase";
import type { CotizacionDolar } from "./dolar";

export type ConfigNegocio = {
  nombre_negocio: string | null;
  cotizacion_usd: number | null;
  // Días que se estima que dura un cartucho de tóner. Se aplica a todas las
  // impresoras marcadas como "lleva tóner" (ver lib/toner.ts). Si está en
  // null, el medidor queda sin configurar y no se generan avisos.
  dias_duracion_toner: number | null;
  updated_at: string;
};

export async function obtenerConfig(): Promise<ConfigNegocio> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as ConfigNegocio;
}

export type ConfigInput = {
  nombre_negocio: string;
  cotizacion_usd: number | null;
  dias_duracion_toner: number | null;
};

export async function guardarConfig(input: ConfigInput): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .update({
      nombre_negocio: input.nombre_negocio.trim() || null,
      cotizacion_usd: input.cotizacion_usd,
      dias_duracion_toner: input.dias_duracion_toner,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw error;
}

// Guarda cada cotización traída de DolarApi.com en el historial. Es
// "best effort": si falla no debería cortar el flujo de actualizar el
// campo en pantalla.
export async function registrarCotizacion(info: CotizacionDolar): Promise<void> {
  const { error } = await supabase.from("exchange_rates").insert({
    fuente: "dolarapi.com",
    tipo: "oficial",
    compra: info.compra,
    venta: info.venta,
    fecha_cotizacion: info.fechaActualizacion,
  });
  if (error) throw error;
}

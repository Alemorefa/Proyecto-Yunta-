"use client";

// Parte del medidor de tóner que habla con Supabase. El cálculo en sí vive
// en lib/toner-calculo.ts (sin "use client") porque también lo usa la ruta
// del cron del lado del servidor; acá se re-exporta para que las pantallas
// importen todo de un solo lugar.

import { supabase } from "./supabase";
import { TIPOS_CARGA_TONER, type ImpresoraAgotada, type ImpresoraToner, type MovimientoToner } from "./toner-calculo";

export {
  calcularEstadoToner,
  impresorasConTonerAgotado,
  hoyISO,
  TIPOS_CARGA_TONER,
} from "./toner-calculo";
export type { EstadoToner, ImpresoraAgotada, ImpresoraToner, MovimientoToner } from "./toner-calculo";

// Datos mínimos para saber si hay que avisar de algún tóner agotado.
//
// La campana del encabezado está en todas las pantallas, así que esto se
// ejecuta en cada navegación: por eso pide solo las impresoras activas CON
// tóner y solo los movimientos que recargan el cartucho, en vez de traerse
// las tablas enteras (printer_movements crece para siempre).
export async function cargarDatosToner(): Promise<{
  impresoras: ImpresoraToner[];
  movimientos: MovimientoToner[];
}> {
  const [impresorasRes, movimientosRes] = await Promise.all([
    supabase
      .from("printers")
      .select("id, modelo, store_id, activa, usa_toner, dias_toner")
      .eq("usa_toner", true)
      .eq("activa", true)
      .not("dias_toner", "is", null),
    supabase.from("printer_movements").select("printer_id, fecha, tipo").in("tipo", TIPOS_CARGA_TONER),
  ]);

  if (impresorasRes.error) throw impresorasRes.error;
  if (movimientosRes.error) throw movimientosRes.error;

  return {
    impresoras: (impresorasRes.data ?? []) as ImpresoraToner[],
    movimientos: (movimientosRes.data ?? []) as MovimientoToner[],
  };
}

// ---- Alertas ya registradas (para no repetir el mail y saber si se vio) ----

export type TonerAlerta = {
  id: string;
  printer_id: string;
  desde_movimiento: string;
  visto_en_app: boolean;
  email_enviado: boolean;
};

export async function listarAlertasToner(): Promise<TonerAlerta[]> {
  const { data, error } = await supabase
    .from("toner_alertas")
    .select("id, printer_id, desde_movimiento, visto_en_app, email_enviado");
  if (error) throw error;
  return (data ?? []) as TonerAlerta[];
}

// Marca como vistos los avisos que el admin acaba de ver en la campana, para
// que el cron diario no le mande además un mail por lo mismo. Crea la fila
// si todavía no existía (el aviso se detecta en la app aunque el cron no
// haya pasado). Solo la puede llamar un admin (RLS).
export async function marcarAlertasVistas(
  agotadas: ImpresoraAgotada<ImpresoraToner>[],
  usuarioId: string | null
): Promise<void> {
  if (agotadas.length === 0) return;
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("toner_alertas").upsert(
    agotadas.map((a) => ({
      printer_id: a.impresora.id,
      desde_movimiento: a.desdeMovimiento,
      visto_en_app: true,
      visto_por: usuarioId,
      fecha_visto: ahora,
    })),
    { onConflict: "printer_id,desde_movimiento" }
  );
  if (error) throw error;
}

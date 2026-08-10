"use client";

// Inventario (activos) — ahora en Supabase (tabla assets, más
// asset_movements para el historial y asset_photos para las fotos) en vez
// de localStorage.

import { supabase } from "./supabase";
import type { EstadoActivo, AccionMovimiento } from "./db";

export type Activo = {
  id: string;
  codigo_interno: string;
  nombre: string;
  descripcion: string | null;
  category_id: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  estado: EstadoActivo;
  fecha_compra: string | null;
  supplier_id: string | null;
  cantidad: number;
  precio_ars: number | null;
  precio_usd: number | null;
  store_id: string | null;
  sector_id: string | null;
  responsable: string | null;
  observaciones: string | null;
  fecha_creacion: string;
  fecha_baja: string | null;
  motivo_baja: string | null;
  foto_url?: string | null;
  printer_id: string | null;
};

export function valorTotalARS(a: Pick<Activo, "cantidad" | "precio_ars">) {
  return (a.cantidad || 1) * (a.precio_ars || 0);
}

export function valorTotalUSD(a: Pick<Activo, "cantidad" | "precio_usd">) {
  return (a.cantidad || 1) * (a.precio_usd || 0);
}

export async function listarActivos(): Promise<Activo[]> {
  const { data, error } = await supabase.from("assets").select("*").order("fecha_creacion", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activo[];
}

// Última foto cargada por activo (id de activo -> url). El modelo nuevo
// permite varias fotos por activo; acá solo usamos "la más reciente" para
// mantener el mismo comportamiento de miniatura única que tenía la app.
export async function listarUltimaFotoPorActivo(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("asset_photos")
    .select("asset_id, url, fecha_subida")
    .order("fecha_subida", { ascending: false });
  if (error) throw error;
  const mapa = new Map<string, string>();
  for (const fila of data ?? []) {
    if (!mapa.has(fila.asset_id)) mapa.set(fila.asset_id, fila.url);
  }
  return mapa;
}

export async function existeCodigoInterno(codigo: string, excluirId?: string): Promise<boolean> {
  let query = supabase.from("assets").select("id").ilike("codigo_interno", codigo);
  if (excluirId) query = query.neq("id", excluirId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
}

export type ActivoInput = {
  codigo_interno: string;
  nombre: string;
  descripcion: string;
  categoria_id: string | null;
  marca: string;
  modelo: string;
  numero_serie: string;
  estado: EstadoActivo;
  fecha_compra: string;
  supplier_id: string | null;
  cantidad: number;
  precio_ars: number;
  precio_usd: number;
  tienda_id: string | null;
  sector_id: string | null;
  responsable: string;
  observaciones: string;
};

function payloadDe(input: ActivoInput) {
  return {
    codigo_interno: input.codigo_interno.trim(),
    nombre: input.nombre.trim(),
    descripcion: input.descripcion.trim() || null,
    category_id: input.categoria_id,
    marca: input.marca.trim() || null,
    modelo: input.modelo.trim() || null,
    numero_serie: input.numero_serie.trim() || null,
    estado: input.estado,
    fecha_compra: input.fecha_compra || null,
    supplier_id: input.supplier_id,
    cantidad: input.cantidad,
    precio_ars: input.precio_ars,
    precio_usd: input.precio_usd,
    store_id: input.tienda_id,
    sector_id: input.sector_id,
    responsable: input.responsable.trim() || null,
    observaciones: input.observaciones.trim() || null,
  };
}

export async function crearActivo(input: ActivoInput): Promise<Activo> {
  const { data, error } = await supabase.from("assets").insert(payloadDe(input)).select().single();
  if (error) throw error;
  return data as Activo;
}

export async function actualizarActivo(id: string, input: ActivoInput): Promise<Activo> {
  const { data, error } = await supabase.from("assets").update(payloadDe(input)).eq("id", id).select().single();
  if (error) throw error;
  return data as Activo;
}

// Busca el activo vinculado a una impresora (si tiene uno) — se usa desde
// lib/vinculo-impresoras.ts para reflejar en Inventario los cambios que se
// hacen del lado de Impresoras.
export async function buscarActivoPorImpresora(printerId: string): Promise<Activo | null> {
  const { data, error } = await supabase.from("assets").select("*").eq("printer_id", printerId).maybeSingle();
  if (error) throw error;
  return (data as Activo) ?? null;
}

// Actualiza solo los campos indicados de un activo (a diferencia de
// actualizarActivo, que reemplaza el formulario completo) — se usa para
// reflejar cambios que vienen del lado de la impresora vinculada, sin tocar
// el resto de los datos del activo (descripción, precio, etc.).
export async function sincronizarActivoVinculado(
  id: string,
  cambios: { store_id?: string; estado?: EstadoActivo; nombre?: string; modelo?: string }
): Promise<void> {
  const { error } = await supabase.from("assets").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function transferirActivo(
  id: string,
  destino: { store_id: string; sector_id: string | null }
): Promise<void> {
  const { error } = await supabase.from("assets").update(destino).eq("id", id);
  if (error) throw error;
}

export async function darDeBajaActivo(id: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from("assets")
    .update({ estado: "Baja", fecha_baja: new Date().toISOString(), motivo_baja: motivo.trim() })
    .eq("id", id);
  if (error) throw error;
}

// Baja parcial: cuando un ítem tiene cantidad > 1 y solo se rompe/pierde
// alguna unidad, esto resta del total en vez de dar de baja todo el lote.
export async function reducirCantidadActivo(id: string, nuevaCantidad: number): Promise<void> {
  const { error } = await supabase.from("assets").update({ cantidad: nuevaCantidad }).eq("id", id);
  if (error) throw error;
}

export async function cambiarEstadoActivo(id: string, estado: EstadoActivo): Promise<void> {
  const { error } = await supabase.from("assets").update({ estado }).eq("id", id);
  if (error) throw error;
}

// Busca un proveedor por nombre (sin importar mayúsculas) y si no existe lo
// crea. Devuelve null si el nombre viene vacío.
export async function buscarOCrearProveedor(nombre: string): Promise<string | null> {
  const limpio = nombre.trim();
  if (!limpio) return null;
  const existente = await supabase.from("suppliers").select("id").ilike("nombre", limpio).maybeSingle();
  if (existente.error) throw existente.error;
  if (existente.data) return existente.data.id;
  const creado = await supabase.from("suppliers").insert({ nombre: limpio }).select("id").single();
  if (creado.error) throw creado.error;
  return creado.data.id;
}

export type MovimientoInput = {
  activo_id: string;
  accion: AccionMovimiento;
  observacion?: string;
  usuario_id: string | null;
  store_origen_id?: string | null;
  store_destino_id?: string | null;
  sector_origen_id?: string | null;
  sector_destino_id?: string | null;
};

export async function registrarMovimientoActivo(input: MovimientoInput): Promise<void> {
  const { error } = await supabase.from("asset_movements").insert({
    asset_id: input.activo_id,
    accion: input.accion,
    observacion: input.observacion || null,
    usuario_id: input.usuario_id,
    store_origen_id: input.store_origen_id ?? null,
    store_destino_id: input.store_destino_id ?? null,
    sector_origen_id: input.sector_origen_id ?? null,
    sector_destino_id: input.sector_destino_id ?? null,
  });
  if (error) throw error;
}

// Reemplaza la foto de un activo (borra las anteriores y sube la nueva).
// La imagen todavía viaja como data URL (base64) directo a la columna
// `url`, igual que en el prototipo local — pasar esto a Supabase Storage
// queda pendiente como mejora futura.
export async function reemplazarFotoActivo(assetId: string, dataUrl: string | null): Promise<void> {
  const { error: errorBorrar } = await supabase.from("asset_photos").delete().eq("asset_id", assetId);
  if (errorBorrar) throw errorBorrar;
  if (dataUrl) {
    const { error } = await supabase.from("asset_photos").insert({ asset_id: assetId, url: dataUrl });
    if (error) throw error;
  }
}

export type Proveedor = { id: string; nombre: string };

export async function listarProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase.from("suppliers").select("id, nombre").order("nombre");
  if (error) throw error;
  return (data ?? []) as Proveedor[];
}

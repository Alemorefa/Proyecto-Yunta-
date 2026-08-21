"use client";

// Tiendas, sectores y categorías — ahora viven en Supabase (tablas stores,
// sectors, categories) en vez de localStorage. Los nombres de función están
// en español para que combinen con el resto del código de la app.

import { supabase } from "./supabase";

export type EstadoTienda = "activa" | "inactiva";

export type Tienda = {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string | null;
  responsable: string | null;
  estado: EstadoTienda;
  observaciones: string | null;
  fecha_creacion: string;
};

export type Sector = {
  id: string;
  store_id: string;
  nombre: string;
};

export type Categoria = {
  id: string;
  nombre: string;
};

export async function listarTiendas(): Promise<Tienda[]> {
  const { data, error } = await supabase.from("stores").select("*").order("nombre");
  if (error) throw error;
  return (data ?? []) as Tienda[];
}

export async function listarSectores(): Promise<Sector[]> {
  const { data, error } = await supabase.from("sectors").select("*");
  if (error) throw error;
  return (data ?? []) as Sector[];
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categories").select("*").order("nombre");
  if (error) throw error;
  return (data ?? []) as Categoria[];
}

export type TiendaInput = {
  nombre: string;
  codigo: string;
  direccion: string;
  responsable: string;
  observaciones: string;
};

export async function crearTienda(input: TiendaInput): Promise<Tienda> {
  const { data, error } = await supabase
    .from("stores")
    .insert({
      nombre: input.nombre.trim(),
      codigo: input.codigo.trim(),
      direccion: input.direccion.trim() || null,
      responsable: input.responsable.trim() || null,
      observaciones: input.observaciones.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Tienda;
}

export async function actualizarTienda(id: string, input: TiendaInput): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({
      nombre: input.nombre.trim(),
      codigo: input.codigo.trim(),
      direccion: input.direccion.trim() || null,
      responsable: input.responsable.trim() || null,
      observaciones: input.observaciones.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cambiarEstadoTienda(id: string, estado: EstadoTienda): Promise<void> {
  const { error } = await supabase.from("stores").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function crearSectores(tiendaId: string, nombres: string[]): Promise<void> {
  if (nombres.length === 0) return;
  const { error } = await supabase
    .from("sectors")
    .insert(nombres.map((nombre) => ({ store_id: tiendaId, nombre: nombre.trim() })));
  if (error) throw error;
}

export async function borrarSectores(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("sectors").delete().in("id", ids);
  if (error) throw error;
}

export async function contarActivosPorTienda(tiendaId: string): Promise<number> {
  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("store_id", tiendaId)
    .neq("estado", "Baja");
  if (error) throw error;
  return count ?? 0;
}

export async function contarActivosPorSectores(sectorIds: string[]): Promise<number> {
  if (sectorIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .in("sector_id", sectorIds)
    .neq("estado", "Baja");
  if (error) throw error;
  return count ?? 0;
}

export async function crearCategoria(nombre: string): Promise<Categoria> {
  const { data, error } = await supabase.from("categories").insert({ nombre: nombre.trim() }).select().single();
  if (error) throw error;
  return data as Categoria;
}

export async function borrarCategoria(id: string): Promise<void> {
  // Los activos que tenían esta categoría quedan con category_id NULL solos
  // (la relación tiene ON DELETE SET NULL en la base).
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function contarActivosPorCategoria(categoriaId: string): Promise<number> {
  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoriaId)
    .neq("estado", "Baja");
  if (error) throw error;
  return count ?? 0;
}

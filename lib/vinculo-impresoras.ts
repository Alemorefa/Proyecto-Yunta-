"use client";

// Mantiene sincronizados un activo de categoría "Impresoras" (en Inventario)
// y su impresora asociada (en el módulo Impresoras). Por ahora los dos lados
// se pueden editar (tienda, baja, modelo/nombre) — este archivo se encarga
// de reflejar el cambio del lado que se editó hacia el otro.
//
// No hay triggers en la base: la sincronización pasa por acá, así que
// cualquier pantalla que mueva/dé de baja/edite un activo o una impresora
// vinculada tiene que llamar a la función correspondiente después de guardar.

import { supabase } from "./supabase";
import { buscarActivoPorImpresora, sincronizarActivoVinculado, type Activo } from "./inventario-data";
import {
  crearImpresora,
  editarImpresora,
  moverImpresoraDeTienda,
  cambiarEstadoImpresora,
  cambiarUsaToner,
  type Impresora,
} from "./impresoras-data";

export const NOMBRE_CATEGORIA_IMPRESORAS = "Impresoras";

export function esCategoriaImpresora(
  categorias: { id: string; nombre: string }[],
  categoriaId: string | null | undefined
): boolean {
  if (!categoriaId) return false;
  const cat = categorias.find((c) => c.id === categoriaId);
  return !!cat && cat.nombre.trim().toLowerCase() === NOMBRE_CATEGORIA_IMPRESORAS.toLowerCase();
}

// Llamar después de crear/editar (desde Inventario) un activo de categoría
// "Impresoras": si no tenía impresora vinculada todavía, crea una y la
// vincula; si ya tenía, la actualiza para que quede igual al activo.
export async function sincronizarImpresoraDesdeActivo(
  activo: Activo,
  usaToner = true
): Promise<void> {
  if (!activo.store_id) return; // una impresora necesita tienda
  const modelo = activo.modelo || activo.nombre;
  if (activo.printer_id) {
    await editarImpresora(activo.printer_id, modelo);
    await moverImpresoraDeTienda(activo.printer_id, activo.store_id);
    await cambiarEstadoImpresora(activo.printer_id, activo.estado !== "Baja");
    await cambiarUsaToner(activo.printer_id, usaToner);
  } else {
    const nueva = await crearImpresora(modelo, activo.store_id, usaToner);
    const { error } = await supabase.from("assets").update({ printer_id: nueva.id }).eq("id", activo.id);
    if (error) throw error;
  }
}

// Llamar después de crear una impresora nueva desde el módulo Impresoras
// (no desde Inventario): le crea un activo vinculado de categoría
// "Impresoras", para que también aparezca en Inventario. Si la impresora ya
// tiene un activo vinculado (por ejemplo, se creó desde Inventario y este
// módulo la creó a ella), no hace nada.
export async function asegurarActivoParaImpresora(printer: Impresora): Promise<void> {
  const existente = await buscarActivoPorImpresora(printer.id);
  if (existente) return;

  const { data: catExistente, error: errCat } = await supabase
    .from("categories")
    .select("id")
    .ilike("nombre", NOMBRE_CATEGORIA_IMPRESORAS)
    .maybeSingle();
  if (errCat) throw errCat;

  let categoriaId: string;
  if (catExistente) {
    categoriaId = catExistente.id;
  } else {
    const { data: catNueva, error: errCrear } = await supabase
      .from("categories")
      .insert({ nombre: NOMBRE_CATEGORIA_IMPRESORAS })
      .select("id")
      .single();
    if (errCrear) throw errCrear;
    categoriaId = catNueva.id;
  }

  const { error: errActivo } = await supabase.from("assets").insert({
    codigo_interno: `IMP-${printer.id.slice(0, 8)}`,
    nombre: printer.modelo,
    category_id: categoriaId,
    modelo: printer.modelo,
    estado: printer.activa ? "Bueno" : "Baja",
    cantidad: 1,
    store_id: printer.store_id,
    observaciones: printer.observaciones,
    printer_id: printer.id,
  });
  if (errActivo) throw errActivo;
}

// Devuelve si la impresora vinculada a un activo lleva tóner, para poder
// mostrar el check ya marcado al editar el activo desde Inventario.
export async function usaTonerDeActivo(printerId: string | null): Promise<boolean> {
  if (!printerId) return true;
  const { data, error } = await supabase.from("printers").select("usa_toner").eq("id", printerId).maybeSingle();
  if (error) throw error;
  return data?.usa_toner ?? true;
}

// Llamar después de mover/dar de baja/renombrar una impresora (desde el
// módulo Impresoras, o desde las acciones sobre impresoras en Inventario):
// si tiene un activo vinculado, refleja el cambio ahí también.
export async function sincronizarActivoDesdeImpresora(
  impresora: Pick<Impresora, "id">,
  cambios: { store_id?: string; activa?: boolean; modelo?: string }
): Promise<void> {
  const activo = await buscarActivoPorImpresora(impresora.id);
  if (!activo) return;
  await sincronizarActivoVinculado(activo.id, {
    store_id: cambios.store_id,
    estado: cambios.activa === undefined ? undefined : cambios.activa ? "Bueno" : "Baja",
    nombre: cambios.modelo,
    modelo: cambios.modelo,
  });
}

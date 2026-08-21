"use client";

// Buscador global de la topbar — antes filtraba el DB local en memoria,
// ahora consulta Supabase (assets, stores, printers) directamente.

import { supabase } from "./supabase";

export type ResultadoBusqueda = {
  tipo: string;
  label: string;
  sub?: string;
  href: string;
};

export async function buscarGlobal(termino: string): Promise<ResultadoBusqueda[]> {
  const q = termino.trim().replace(/,/g, " ");
  if (!q) return [];

  const [activosRes, tiendasRes, impresorasRes] = await Promise.all([
    supabase
      .from("assets")
      .select("nombre, codigo_interno")
      .or(`nombre.ilike.%${q}%,codigo_interno.ilike.%${q}%,descripcion.ilike.%${q}%`)
      .limit(4),
    supabase.from("stores").select("nombre, codigo").or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`).limit(3),
    supabase.from("printers").select("modelo").ilike("modelo", `%${q}%`).limit(3),
  ]);

  const resultados: ResultadoBusqueda[] = [];

  for (const a of activosRes.data ?? []) {
    resultados.push({
      tipo: "Activo",
      label: a.nombre,
      sub: a.codigo_interno,
      href: `/inventario?buscar=${encodeURIComponent(a.codigo_interno)}`,
    });
  }

  for (const t of tiendasRes.data ?? []) {
    resultados.push({ tipo: "Tienda", label: t.nombre, sub: t.codigo, href: "/tiendas" });
  }

  for (const i of impresorasRes.data ?? []) {
    resultados.push({ tipo: "Impresora", label: i.modelo, href: "/impresoras" });
  }

  return resultados.slice(0, 6);
}

"use client";

// Importador ÚNICO: copia los datos que hoy viven en localStorage (los que
// cargaste con el prototipo) a las tablas reales de Supabase. Se corre UNA
// sola vez desde Configuración (solo lo ve un admin). No borra nada de
// localStorage — así que si algo sale mal, no se pierde información y se
// puede reintentar.
//
// Cosas a tener en cuenta:
// - Los "usuarios" de la pantalla local de Usuarios NO se migran (no se
//   puede crear una cuenta con contraseña real por otra persona desde acá).
//   Cada persona tiene que crear su cuenta real desde el login.
// - Los movimientos históricos quedan asociados a quien corre la migración
//   (vos), pero el nombre de quien lo hizo originalmente se guarda como
//   texto dentro de la observación, para no perder el dato.

import { getDB } from "./db";
import { supabase } from "./supabase";

export type ResultadoMigracion = {
  ok: boolean;
  resumen: string[];
  error?: string;
};

export async function migrarDatosLocalesASupabase(): Promise<ResultadoMigracion> {
  const resumen: string[] = [];
  try {
    const db = getDB();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const usuarioActualId = user?.id ?? null;

    // 1) Categorías (la tabla exige nombres únicos, así que deduplicamos)
    const categoriaIdMap = new Map<string, string>();
    const nombresCategoria = Array.from(
      new Map(db.categorias.map((c) => [c.nombre.trim().toLowerCase(), c.nombre.trim()])).values()
    );
    if (nombresCategoria.length > 0) {
      const { data: catInsertadas, error } = await supabase
        .from("categories")
        .insert(nombresCategoria.map((nombre) => ({ nombre })))
        .select("id, nombre");
      if (error) throw new Error("Categorías: " + error.message);
      for (const c of db.categorias) {
        const match = catInsertadas?.find((x) => x.nombre.trim().toLowerCase() === c.nombre.trim().toLowerCase());
        if (match) categoriaIdMap.set(c.id, match.id);
      }
      resumen.push(`${catInsertadas?.length ?? 0} categorías`);
    }

    // 2) Tiendas
    const tiendaIdMap = new Map<string, string>();
    if (db.tiendas.length > 0) {
      const { data: tiendasInsertadas, error } = await supabase
        .from("stores")
        .insert(
          db.tiendas.map((t) => ({
            nombre: t.nombre,
            codigo: t.codigo,
            direccion: t.direccion || null,
            responsable: t.responsable || null,
            estado: t.estado,
            observaciones: t.observaciones || null,
          }))
        )
        .select("id");
      if (error) throw new Error("Tiendas: " + error.message);
      db.tiendas.forEach((t, i) => {
        const nueva = tiendasInsertadas?.[i];
        if (nueva) tiendaIdMap.set(t.id, nueva.id);
      });
      resumen.push(`${tiendasInsertadas?.length ?? 0} tiendas`);
    }

    // 3) Sectores
    const sectorIdMap = new Map<string, string>();
    const sectoresValidos = db.sectores.filter((s) => tiendaIdMap.has(s.tienda_id));
    if (sectoresValidos.length > 0) {
      const { data: sectoresInsertados, error } = await supabase
        .from("sectors")
        .insert(
          sectoresValidos.map((s) => ({
            store_id: tiendaIdMap.get(s.tienda_id),
            nombre: s.nombre,
          }))
        )
        .select("id");
      if (error) throw new Error("Sectores: " + error.message);
      sectoresValidos.forEach((s, i) => {
        const nuevo = sectoresInsertados?.[i];
        if (nuevo) sectorIdMap.set(s.id, nuevo.id);
      });
      resumen.push(`${sectoresInsertados?.length ?? 0} sectores`);
    }

    // 4) Proveedores (antes era texto libre en cada activo; ahora es catálogo propio)
    const proveedorIdMap = new Map<string, string>();
    const nombresProveedor = Array.from(
      new Set(db.activos.map((a) => (a.proveedor || "").trim()).filter((p) => p.length > 0))
    );
    if (nombresProveedor.length > 0) {
      const { data: proveedoresInsertados, error } = await supabase
        .from("suppliers")
        .insert(nombresProveedor.map((nombre) => ({ nombre })))
        .select("id, nombre");
      if (error) throw new Error("Proveedores: " + error.message);
      for (const nombre of nombresProveedor) {
        const match = proveedoresInsertados?.find((x) => x.nombre.trim().toLowerCase() === nombre.toLowerCase());
        if (match) proveedorIdMap.set(nombre.toLowerCase(), match.id);
      }
      resumen.push(`${proveedoresInsertados?.length ?? 0} proveedores`);
    }

    // 5) Activos
    const activoIdMap = new Map<string, string>();
    if (db.activos.length > 0) {
      const { data: activosInsertados, error } = await supabase
        .from("assets")
        .insert(
          db.activos.map((a) => ({
            codigo_interno: a.codigo_interno,
            nombre: a.nombre,
            descripcion: a.descripcion || null,
            category_id: a.categoria_id ? categoriaIdMap.get(a.categoria_id) || null : null,
            marca: a.marca || null,
            modelo: a.modelo || null,
            numero_serie: a.numero_serie || null,
            estado: a.estado,
            fecha_compra: a.fecha_compra || null,
            supplier_id: a.proveedor ? proveedorIdMap.get(a.proveedor.trim().toLowerCase()) || null : null,
            cantidad: a.cantidad ?? 1,
            precio_ars: a.precio_ars ?? null,
            precio_usd: a.precio_usd ?? null,
            store_id: a.tienda_id ? tiendaIdMap.get(a.tienda_id) || null : null,
            sector_id: a.sector_id ? sectorIdMap.get(a.sector_id) || null : null,
            responsable: a.responsable || null,
            observaciones: a.observaciones || null,
            fecha_baja: a.fecha_baja || null,
            motivo_baja: a.motivo_baja || null,
          }))
        )
        .select("id");
      if (error) throw new Error("Activos: " + error.message);
      db.activos.forEach((a, i) => {
        const nuevo = activosInsertados?.[i];
        if (nuevo) activoIdMap.set(a.id, nuevo.id);
      });
      resumen.push(`${activosInsertados?.length ?? 0} activos`);

      const fotos = db.activos
        .filter((a) => a.foto_url && activoIdMap.has(a.id))
        .map((a) => ({ asset_id: activoIdMap.get(a.id) as string, url: a.foto_url as string }));
      if (fotos.length > 0) {
        const { error: errorFotos } = await supabase.from("asset_photos").insert(fotos);
        if (errorFotos) throw new Error("Fotos: " + errorFotos.message);
        resumen.push(`${fotos.length} fotos`);
      }
    }

    // 6) Movimientos de activos
    const movimientosValidos = db.movimientos.filter((m) => activoIdMap.has(m.activo_id));
    if (movimientosValidos.length > 0) {
      const { error } = await supabase.from("asset_movements").insert(
        movimientosValidos.map((m) => ({
          asset_id: activoIdMap.get(m.activo_id),
          fecha: m.fecha,
          usuario_id: usuarioActualId,
          accion: m.accion,
          observacion: (m.observacion || "") + (m.usuario ? ` [importado, usuario original: ${m.usuario}]` : ""),
          store_origen_id: m.tienda_origen_id ? tiendaIdMap.get(m.tienda_origen_id) || null : null,
          store_destino_id: m.tienda_destino_id ? tiendaIdMap.get(m.tienda_destino_id) || null : null,
          sector_origen_id: m.sector_origen_id ? sectorIdMap.get(m.sector_origen_id) || null : null,
          sector_destino_id: m.sector_destino_id ? sectorIdMap.get(m.sector_destino_id) || null : null,
        }))
      );
      if (error) throw new Error("Movimientos: " + error.message);
      resumen.push(`${movimientosValidos.length} movimientos`);
    }

    // 7) Impresoras
    const impresoraIdMap = new Map<string, string>();
    if (db.impresoras.length > 0) {
      const { data: impresorasInsertadas, error } = await supabase
        .from("printers")
        .insert(
          db.impresoras.map((i) => ({
            modelo: i.modelo,
            store_id: i.tienda_id ? tiendaIdMap.get(i.tienda_id) || null : null,
            observaciones: i.observaciones || null,
          }))
        )
        .select("id");
      if (error) throw new Error("Impresoras: " + error.message);
      db.impresoras.forEach((i, idx) => {
        const nueva = impresorasInsertadas?.[idx];
        if (nueva) impresoraIdMap.set(i.id, nueva.id);
      });
      resumen.push(`${impresorasInsertadas?.length ?? 0} impresoras`);
    }

    // 8) Movimientos de impresoras
    const movImpresoraValidos = db.movimientosImpresora.filter((m) => impresoraIdMap.has(m.impresora_id));
    if (movImpresoraValidos.length > 0) {
      const { error } = await supabase.from("printer_movements").insert(
        movImpresoraValidos.map((m) => ({
          printer_id: impresoraIdMap.get(m.impresora_id),
          fecha: m.fecha,
          tipo: m.tipo,
          observacion: (m.observacion || "") + (m.usuario ? ` [importado, usuario original: ${m.usuario}]` : ""),
          usuario_id: usuarioActualId,
        }))
      );
      if (error) throw new Error("Movimientos de impresoras: " + error.message);
      resumen.push(`${movImpresoraValidos.length} movimientos de impresoras`);
    }

    // 9) Configuración general
    const { error: errorSettings } = await supabase
      .from("settings")
      .update({
        nombre_negocio: db.config.nombre || null,
        cotizacion_usd: db.config.cotizacion_usd ?? null,
      })
      .eq("id", 1);
    if (errorSettings) throw new Error("Configuración: " + errorSettings.message);
    resumen.push("configuración general");

    return { ok: true, resumen };
  } catch (err) {
    return { ok: false, resumen, error: (err as Error).message };
  }
}

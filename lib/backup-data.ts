"use client";

// Backup completo: junta todo lo que hoy vive en Supabase (tiendas,
// sectores, categorías, inventario, movimientos, impresoras, usuarios y
// configuración) en un solo JSON descargable. Es de solo lectura — no hay
// una función de "importar" porque restaurar un backup completo pisando
// datos reales de Supabase es una operación riesgosa; si alguna vez hace
// falta restaurar algo puntual conviene hacerlo a mano desde el Table
// Editor de Supabase con este JSON como referencia.

import { listarTiendas, listarSectores, listarCategorias } from "./catalogos";
import { listarActivos, listarProveedores } from "./inventario-data";
import { listarMovimientos } from "./movimientos-data";
import { listarImpresoras, listarMovimientosImpresora } from "./impresoras-data";
import { listarUsuarios } from "./usuarios-data";
import { obtenerConfig } from "./config-data";

export async function generarBackupCompleto() {
  const [
    tiendas,
    sectores,
    categorias,
    proveedores,
    activos,
    movimientos,
    impresoras,
    movimientosImpresora,
    usuarios,
    config,
  ] = await Promise.all([
    listarTiendas(),
    listarSectores(),
    listarCategorias(),
    listarProveedores(),
    listarActivos(),
    listarMovimientos(),
    listarImpresoras(),
    listarMovimientosImpresora(),
    listarUsuarios(),
    obtenerConfig(),
  ]);

  return {
    generado: new Date().toISOString(),
    config,
    tiendas,
    sectores,
    categorias,
    proveedores,
    activos,
    movimientos,
    impresoras,
    movimientosImpresora,
    usuarios,
  };
}

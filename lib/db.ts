// Capa de datos del prototipo (localStorage).
// Modela las entidades de la especificación "Sistema de Inventario - LY25 BMT":
// tiendas, sectores, categorías, activos (con historial de movimientos) y usuarios.
// Pensada para migrarse 1:1 a tablas de Supabase (Postgres) más adelante:
// stores, sectors, categories, assets, asset_movements, users, settings.

import { useEffect, useState } from "react";
import { esFechaSinHora, formatearFechaSinHora } from "./fechas";

export type EstadoTienda = "activa" | "inactiva";

export type Tienda = {
  id: string;
  nombre: string;
  codigo: string;
  direccion?: string;
  responsable?: string;
  estado: EstadoTienda;
  observaciones?: string;
  fecha_creacion?: string;
};

export type Sector = {
  id: string;
  tienda_id: string;
  nombre: string;
};

export type Categoria = {
  id: string;
  nombre: string;
};

export type EstadoActivo = "Nuevo" | "Bueno" | "Malo" | "Baja";

// Un "activo" puede ser una unidad única con número de serie (ej. un
// servidor) o un ítem agrupado con cantidad (ej. "Cámaras x26 unidades").
// precio_ars / precio_usd son precios UNITARIOS; el valor total de la línea
// es cantidad * precio (se calcula, no se guarda) para que el Dashboard y
// las exportaciones siempre sumen en base al mismo dato.
export type Activo = {
  id: string;
  codigo_interno: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string | null;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  estado: EstadoActivo;
  fecha_compra?: string;
  proveedor?: string;
  cantidad: number;
  precio_ars?: number;
  precio_usd?: number;
  tienda_id?: string | null;
  sector_id?: string | null;
  responsable?: string;
  observaciones?: string;
  es_comodato?: boolean;
  foto_url?: string;
  fecha_creacion?: string;
  fecha_baja?: string;
  motivo_baja?: string;
};

export function valorTotalARS(a: Activo) {
  return (a.cantidad || 1) * (a.precio_ars || 0);
}

export function valorTotalUSD(a: Activo) {
  return (a.cantidad || 1) * (a.precio_usd || 0);
}

export type AccionMovimiento =
  | "Alta"
  | "Modificación"
  | "Cambio de estado"
  | "Cambio de sector"
  | "Transferencia"
  | "Baja";

export type Movimiento = {
  id: string;
  activo_id: string;
  fecha: string;
  usuario: string;
  accion: AccionMovimiento;
  observacion?: string;
  tienda_origen_id?: string | null;
  tienda_destino_id?: string | null;
  sector_origen_id?: string | null;
  sector_destino_id?: string | null;
};

export type RolUsuario = "admin" | "usuario";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: RolUsuario;
  activo?: boolean;
  fecha_creacion?: string;
  // Contraseña del login local (texto plano en localStorage: es el
  // prototipo, no una solución segura). Se reemplaza por Supabase Auth
  // (hash + sesiones reales) más adelante.
  contrasena?: string;
};

export type ConfigNegocio = {
  nombre?: string;
  cotizacion_usd?: number;
};

// ---- Módulo Impresoras (recargas / cambios de cartucho por tienda) ----
// Replica la planilla que ya usan: una impresora vive en una tienda, y cada
// fila es un movimiento (compra, compra económica, recarga, reset) con una
// columna calculada que dice cuántos días pasaron desde el movimiento
// anterior de esa misma impresora.

// "Transferencia" y "Baja" no son elegibles a mano en "Registrar movimiento"
// (ver TIPOS_MOVIMIENTO_IMPRESORA más abajo) — se generan solos cuando se
// mueve una impresora de tienda o se le da de baja, para que quede el
// registro en el historial.
export type TipoMovimientoImpresora =
  | "Compra"
  | "Compra Económica"
  | "Recarga"
  | "Reset"
  | "Otro"
  | "Transferencia"
  | "Baja";

export const TIPOS_MOVIMIENTO_IMPRESORA: TipoMovimientoImpresora[] = [
  "Compra",
  "Compra Económica",
  "Recarga",
  "Reset",
  "Otro",
];

export type Impresora = {
  id: string;
  modelo: string;
  tienda_id: string;
  observaciones?: string;
  fecha_creacion?: string;
};

export type MovimientoImpresora = {
  id: string;
  impresora_id: string;
  fecha: string; // yyyy-mm-dd
  tipo: TipoMovimientoImpresora;
  observacion?: string;
  usuario?: string;
};

// Mensaje calculado tal como lo vimos en la planilla original: "No hay
// registros anteriores" para el primer movimiento de esa impresora, o
// "{TIPO}/ Reemplaza recarga = N días desde la última vez" para los
// siguientes. ⚠️ Es una interpretación de la lógica de la planilla a partir
// de los ejemplos vistos — conviene confirmarla con el equipo y ajustarla
// en esta función si no coincide exactamente.
export function calcularMensajeMovimiento(
  movimientos: MovimientoImpresora[],
  impresoraId: string,
  fecha: string,
  excluirId?: string
): string {
  // Todos los movimientos previos de esta impresora, sin contar el propio
  // (útil al editar), ordenados del más viejo al más nuevo.
  const historicos = movimientos
    .filter((m) => m.impresora_id === impresoraId && m.id !== excluirId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

  // El "anterior" es el último movimiento con fecha estrictamente anterior;
  // si hay varios en la misma fecha, se toma el último cargado antes que este.
  const anteriores = historicos.filter((m) => m.fecha <= fecha);
  const anterior = anteriores[anteriores.length - 1];

  if (!anterior) return "No hay registros anteriores";

  const dias = Math.max(
    0,
    Math.round((new Date(fecha).getTime() - new Date(anterior.fecha).getTime()) / 86400000)
  );

  return `${anterior.tipo.toUpperCase()}/ Reemplaza recarga = ${dias} días desde la última vez`;
}

export type DB = {
  tiendas: Tienda[];
  sectores: Sector[];
  categorias: Categoria[];
  activos: Activo[];
  movimientos: Movimiento[];
  usuarios: Usuario[];
  config: ConfigNegocio;
  impresoras: Impresora[];
  movimientosImpresora: MovimientoImpresora[];
};

const DB_KEY = "inventarioLY25";

function emptyDB(): DB {
  return {
    tiendas: [],
    sectores: [],
    categorias: [],
    activos: [],
    movimientos: [],
    usuarios: [],
    config: { nombre: "La Yunta", cotizacion_usd: 1000 },
    impresoras: [],
    movimientosImpresora: [],
  };
}

export function getDB(): DB {
  if (typeof window === "undefined") return emptyDB();
  const raw = window.localStorage.getItem(DB_KEY);
  if (!raw) return emptyDB();
  const parsed = JSON.parse(raw) as Partial<DB>;
  return { ...emptyDB(), ...parsed };
}

const ULTIMA_ESCRITURA_KEY = DB_KEY + "_ultimaEscritura";

export function saveDB(data: DB) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(data));
  // Marca de tiempo de la última escritura, usada por el indicador de
  // "Sincronizado hace Xs" del topbar (no hay backend real todavía: esto
  // solo refleja que los datos ya están guardados en este navegador).
  window.localStorage.setItem(ULTIMA_ESCRITURA_KEY, Date.now().toString());
  window.dispatchEvent(new Event("db-changed"));
}

export function getUltimaEscritura(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ULTIMA_ESCRITURA_KEY);
  return raw ? Number(raw) : null;
}

export function useUltimaEscritura() {
  const [ultima, setUltima] = useState<number | null>(null);

  useEffect(() => {
    setUltima(getUltimaEscritura());
    const onChange = () => setUltima(getUltimaEscritura());
    window.addEventListener("db-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("db-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return ultima;
}

export function idGen() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now() {
  return new Date().toISOString();
}

export function formatDate(iso: string) {
  // Las fechas "de calendario" (yyyy-mm-dd, como las de los movimientos de
  // impresora) no tienen hora ni zona: si se pasan por new Date() quedan en
  // medianoche UTC y al mostrarlas en hora local de Argentina retroceden un
  // día. Se formatean como texto. Ver lib/fechas.ts.
  if (esFechaSinHora(iso)) return formatearFechaSinHora(iso);

  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clearAllData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DB_KEY);
}

// Registra un movimiento en el historial de un activo (usado por las
// pantallas de Inventario, Movimientos y automáticamente al crear/editar).
export function registrarMovimiento(
  data: DB,
  params: Omit<Movimiento, "id" | "fecha" | "usuario"> & { usuario?: string }
) {
  data.movimientos.push({
    id: idGen(),
    fecha: now(),
    usuario: params.usuario || "Sistema",
    ...params,
  });
}

const CATEGORIAS_DEFAULT = [
  "Computadoras",
  "Monitores",
  "Impresoras",
  "Routers",
  "Switches",
  "Balanzas",
  "UPS",
  "Cámaras",
  "Telefonía",
  "Rodados",
  "Herramientas",
  "Muebles",
  "Insumos",
  "Otros",
];

const SECTORES_DEFAULT = [
  "Administración",
  "Cajas",
  "Depósito",
  "Sistemas",
  "Carnicería",
  "Verdulería",
  "Fiambrería",
  "Oficina",
  "Recepción",
];

export function seedInitialData() {
  const data = getDB();
  let changed = false;

  if (data.categorias.length === 0) {
    data.categorias = CATEGORIAS_DEFAULT.map((nombre) => ({ id: idGen(), nombre }));
    changed = true;
  }

  if (data.tiendas.length === 0) {
    const tienda: Tienda = {
      id: idGen(),
      nombre: "LY25 Alberdi",
      codigo: "LY25",
      direccion: "",
      responsable: "",
      estado: "activa",
      observaciones: "",
      fecha_creacion: now(),
    };
    data.tiendas.push(tienda);
    data.sectores.push(
      ...SECTORES_DEFAULT.map((nombre) => ({ id: idGen(), tienda_id: tienda.id, nombre }))
    );
    changed = true;
  }

  if (changed) saveDB(data);
}

export const ESTADOS_ACTIVO: EstadoActivo[] = ["Nuevo", "Bueno", "Malo", "Baja"];

/**
 * Script de Importación Masiva de Excel a Supabase
 * Sistema de Inventario · La Yunta
 * 
 * Uso:
 *   node scripts/importar-excel-inventario.mjs "ruta/a/tu/archivo.xlsx" --dry-run
 *   node scripts/importar-excel-inventario.mjs "ruta/a/tu/archivo.xlsx"
 *   node scripts/importar-excel-inventario.mjs "ruta/a/tu/archivo.xlsx" --sheet="INV CENTRO"
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as XLSX_MODULE from 'xlsx';
const XLSX = XLSX_MODULE.default || XLSX_MODULE;
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 1. Cargar variables de entorno desde .env.local
// ---------------------------------------------------------------------------
function cargarEnv() {
  let envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    const altPath = path.resolve(process.cwd(), '..', '.env.local');
    if (fs.existsSync(altPath)) {
      envPath = altPath;
    }
  }

  if (!fs.existsSync(envPath)) {
    console.error('❌ No se encontró el archivo .env.local');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

const env = cargarEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Falta configurar NEXT_PUBLIC_SUPABASE_URL y claves de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// 2. Argumentos de CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoConfirm = args.includes('--yes') || args.includes('-y') || args.includes('--confirm');
const sheetArg = args.find((a) => a.startsWith('--sheet='));
const targetSheet = sheetArg ? sheetArg.split('=')[1].replace(/^["']|["']$/g, '') : null;
const filePathArg = args.find((a) => !a.startsWith('--') && !a.startsWith('-'));

if (!filePathArg) {
  console.log(`
📦 Importador de Inventario Excel para Proyecto La Yunta
─────────────────────────────────────────────────────────────
Uso:
  node scripts/importar-excel-inventario.mjs <archivo.xlsx> [opciones]

Opciones:
  --dry-run          Simula y muestra el resumen sin consultar para guardar
  --yes, -y          Guarda directamente en Supabase sin pedir confirmación
  --sheet="NOMBRE"   Importa únicamente una pestaña específica
  `);
  process.exit(1);
}

let fullExcelPath = path.resolve(process.cwd(), filePathArg);
if (!fs.existsSync(fullExcelPath)) {
  const altPath = path.resolve(process.cwd(), '..', filePathArg);
  if (fs.existsSync(altPath)) {
    fullExcelPath = altPath;
  }
}

if (!fs.existsSync(fullExcelPath)) {
  console.error(`❌ El archivo no existe: ${filePathArg}`);
  console.error(`   Buscado en: ${fullExcelPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Normalización de Nombres de Tiendas y Categorías
// ---------------------------------------------------------------------------
const MAPA_TIENDAS = {
  'INV BALLO': { nombre: 'Balloffet', codigo: 'BALL' },
  'MUEBLES': { nombre: 'Balloffet', codigo: 'BALL' },
  'MAQ Y HERRAMIENTAS': { nombre: 'Balloffet', codigo: 'BALL' },
  'INSTALACIONES': { nombre: 'Balloffet', codigo: 'BALL' },
  'RODADOS': { nombre: 'Balloffet', codigo: 'BALL' },
  'INV VELEZ': { nombre: 'Vélez', codigo: 'VELE' },
  'INV CENTRO': { nombre: 'Centro', codigo: 'CENT' },
  'INV ALEM': { nombre: 'Alem', codigo: 'ALEM' },
  'INV CUADRO BENEGAS': { nombre: 'Cuadro Benegas', codigo: 'CBEN' },
  'ADMIN-COMPRAS-PAGOS-TESORERIA': { nombre: 'Administración y Tesorería', codigo: 'ADMI' },
  'LOGISTICA': { nombre: 'Logística', codigo: 'LOGI' },
  'Alvear': { nombre: 'Alvear', codigo: 'ALVE' },
  'Libertador': { nombre: 'Libertador', codigo: 'LIBE' },
  'Alberdi 107': { nombre: 'Alberdi 107', codigo: 'ALB1' },
  'Atuel Norte': { nombre: 'Atuel Norte', codigo: 'ANOR' },
};

function normalizarTienda(rawName) {
  const s = String(rawName || '').trim();
  const up = s.toUpperCase();
  if (up.includes('BALLO')) return { nombre: 'Balloffet', codigo: 'BALL' };
  if (up.includes('VELEZ')) return { nombre: 'Vélez', codigo: 'VELE' };
  if (up.includes('CUADRO NAC') || up === 'CNAC') return { nombre: 'Cuadro Nacional', codigo: 'CNAC' };
  if (up.includes('CUADRO BEN') || up === 'CBEN') return { nombre: 'Cuadro Benegas', codigo: 'CBEN' };
  if (up.includes('LOGISTICA')) return { nombre: 'Logística', codigo: 'LOGI' };
  if (up.includes('ALVEAR')) return { nombre: 'Alvear', codigo: 'ALVE' };
  if (up.includes('LIBERTADOR')) return { nombre: 'Libertador', codigo: 'LIBE' };
  if (up.includes('ATUEL')) return { nombre: 'Atuel Norte', codigo: 'ANOR' };
  if (up.includes('ALBERDI') || up.includes('MONTOYA')) return { nombre: 'Alberdi 107', codigo: 'ALB1' };
  if (up.includes('CENTRO')) return { nombre: 'Centro', codigo: 'CENT' };
  if (up.includes('ALEM')) return { nombre: 'Alem', codigo: 'ALEM' };
  if (up.includes('ADMIN') || up.includes('TESORERIA')) return { nombre: 'Administración y Tesorería', codigo: 'ADMI' };
  
  if (MAPA_TIENDAS[s]) return MAPA_TIENDAS[s];
  let limpio = s;
  if (limpio.toUpperCase().startsWith('INV ')) limpio = limpio.slice(4).trim();
  const palabras = limpio.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  const codigo = palabras.length === 1 ? palabras[0].slice(0, 4).toUpperCase() : palabras.map((p) => p[0]).join('').slice(0, 4).toUpperCase();
  return { nombre: limpio || 'General', codigo: codigo || 'GEN' };
}

function capitalizar(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatearCategoria(str) {
  if (!str) return 'Muebles y Útiles';
  const limpio = str.replace(/[_\-/]+/g, ' ').trim();
  const upper = limpio.toUpperCase();
  if (upper.includes('INFORMATICA') || upper.includes('TECNOLOGIA') || upper.includes('COMPUT')) return 'Informática y Tecnología';
  if (upper.includes('MUEBLE') || upper.includes('UTILES')) return 'Muebles y Útiles';
  if (upper.includes('INSTALACION') || upper.includes('EQUIPAMIENTO FIJO')) return 'Instalaciones';
  if (upper.includes('MAQ') || upper.includes('HERRAMIENTA')) return 'Maquinarias y Herramientas';
  if (upper.includes('RODADO') || upper.includes('VEHICULO')) return 'Rodados';
  if (upper.includes('COMMODATO') || upper.includes('COMODATO')) return 'Comodato';
  if (/^\d/.test(limpio) || upper.includes('MONTOYA') || upper.includes('ARG=') || upper.includes('CAMBIO')) {
    return 'Muebles y Útiles';
  }
  return limpio.split(/\s+/).map((p) => capitalizar(p)).join(' ');
}

function parsearPrecio(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  const limpio = str.replace(/[^\d.,-]/g, '');
  if (!limpio) return 0;

  if (limpio.includes(',') && limpio.includes('.')) {
    const sinPuntos = limpio.replace(/\./g, '');
    const conPuntoDecimal = sinPuntos.replace(',', '.');
    const num = parseFloat(conPuntoDecimal);
    return isNaN(num) ? 0 : num;
  }
  if (limpio.includes(',')) {
    const num = parseFloat(limpio.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}

function parsearCantidad(val) {
  if (val === undefined || val === null || val === '') return 1;
  if (typeof val === 'number') return isNaN(val) ? 1 : Math.max(1, Math.round(val));
  const str = String(val).trim().replace(/[^\d-]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) || num <= 0 ? 1 : num;
}

// ---------------------------------------------------------------------------
// 4. Parser Inteligente Multi-Layout por Hoja
// ---------------------------------------------------------------------------
function procesarHoja(ws, sheetName) {
  if (sheetName === 'RESUMEN TOTAL' || sheetName === 'Hoja1') return [];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!data || data.length === 0) return [];

  const headerBlocks = [];

  for (let r = 0; r < Math.min(12, data.length); r++) {
    for (let c = 0; c < data[r].length; c++) {
      const val = String(data[r][c]).trim().toUpperCase();
      if (['TIPO', 'ITEM', 'DESCRIPCION', 'CODIFICACION', 'ARTICULO'].includes(val)) {
        let colCant = -1, colSector = -1, colPrecio = -1, colMarca = -1, colDesc = -1, colCod = -1;

        for (let c2 = 0; c2 < Math.min(c + 9, data[r].length); c2++) {
          const v2 = String(data[r][c2]).trim().toUpperCase();
          if (['CODIFICACION', 'CODIGO', 'SKU'].includes(v2)) colCod = c2;
          if (['DESCRIPCION', 'DESCRIPCIÓN', 'TIPO', 'ITEM', 'ARTICULO'].includes(v2)) colDesc = c2;
          if (['CANT.', 'CANTIDAD', 'UNIDADES', 'UNIDAD', 'COLUMNA 1', 'CANT'].includes(v2)) colCant = c2;
          if (['SECTOR', 'UBICACION', 'UBICACIÓN', 'LUGAR'].includes(v2)) colSector = c2;
          if (['PRECIO UNIT.', 'PRECIO', 'UNITARIO', 'MONTO', 'VALOR UNITARIO', 'PRECIO UN.', 'PRECIO UNITARIO'].includes(v2)) colPrecio = c2;
          if (['MARCA/MODELO', 'MARCA', 'MODELO'].includes(v2)) colMarca = c2;
        }

        const colNombreFinal = colDesc !== -1 ? colDesc : c;

        if (colCant === -1 && c + 1 < data[r].length) colCant = c + 1;
        if (colSector === -1 && c + 2 < data[r].length) colSector = c + 2;
        if (colPrecio === -1 && c + 3 < data[r].length) colPrecio = c + 3;

        let cat = 'Muebles y Útiles';
        for (let rCat = r - 1; rCat >= 0; rCat--) {
          const cVal = String(data[rCat][c] || data[rCat][Math.max(0, c - 2)] || data[rCat][c + 1] || '').trim();
          if (cVal && !cVal.startsWith('Tabla') && cVal.toUpperCase() !== 'CAMBIO DÓLAR' && !cVal.startsWith('ARG=')) {
            cat = cVal;
            break;
          }
        }

        if (sheetName === 'MUEBLES') cat = 'Muebles y Útiles';
        if (sheetName === 'MAQ Y HERRAMIENTAS') cat = 'Maquinarias y Herramientas';
        if (sheetName === 'INSTALACIONES') cat = 'Instalaciones';
        if (sheetName === 'RODADOS') cat = 'Rodados';

        headerBlocks.push({
          rStart: r + 1,
          colNombre: colNombreFinal,
          colCod: colCod !== -1 ? colCod : -1,
          colCant,
          colSector,
          colPrecio,
          colMarca,
          cat,
        });
      }
    }
  }

  // Deduplicar bloques superpuestos
  const uniqueBlocks = [];
  for (const b of headerBlocks) {
    if (!uniqueBlocks.some((u) => Math.abs(u.colNombre - b.colNombre) <= 1 && u.rStart === b.rStart)) {
      uniqueBlocks.push(b);
    }
  }

  const items = [];

  for (const b of uniqueBlocks) {
    const catFormateada = formatearCategoria(b.cat);

    for (let r = b.rStart; r < data.length; r++) {
      let nombreRaw = String(data[r]?.[b.colNombre] || '').trim();
      const codRaw = b.colCod !== -1 ? String(data[r]?.[b.colCod] || '').trim() : '';
      const marcaRaw = b.colMarca !== -1 ? String(data[r]?.[b.colMarca] || '').trim() : '';

      if (!nombreRaw && codRaw) nombreRaw = codRaw;
      if (!nombreRaw) continue;

      const upper = nombreRaw.toUpperCase();
      if (upper.startsWith('TOTAL') || upper.includes('TOTAL GENERAL') || upper === 'CAMBIO DÓLAR' || upper.startsWith('ARG=')) {
        continue;
      }

      const cant = b.colCant !== -1 ? parsearCantidad(data[r]?.[b.colCant]) : 1;
      const precio = b.colPrecio !== -1 ? parsearPrecio(data[r]?.[b.colPrecio]) : 0;
      let sector = b.colSector !== -1 ? String(data[r]?.[b.colSector] || '').trim() : '';
      if (!sector || !isNaN(Number(sector))) sector = 'Salón / General';

      let nombreFinal = nombreRaw;
      if (marcaRaw && !nombreRaw.toUpperCase().includes(marcaRaw.toUpperCase())) {
        nombreFinal = `${nombreRaw} (${marcaRaw})`;
      }

      items.push({
        hoja: sheetName,
        categoria: catFormateada,
        codigo_sugerido: codRaw || null,
        nombre: nombreFinal,
        marca: marcaRaw || null,
        cantidad: cant,
        sector: sector,
        precio_ars: precio,
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// 4.1 Parser de Hoja Consolidada
// ---------------------------------------------------------------------------
function procesarHojaConsolidada(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let headerIdx = -1;
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const rowStr = (data[r] || []).join(' ').toLowerCase();
    if (rowStr.includes('id activo') && (rowStr.includes('sucursal') || rowStr.includes('artículo') || rowStr.includes('rubro'))) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const header = data[headerIdx].map((c) => String(c).toLowerCase().trim());
  const colSku = header.findIndex((h) => h.includes('id activo') || h.includes('código') || h === 'sku');
  const colTienda = header.findIndex((h) => h.includes('sucursal') || h.includes('tienda'));
  const colSector = header.findIndex((h) => h.includes('sector') || h.includes('ubicación') || h.includes('ubicacion'));
  const colGranRubro = header.findIndex((h) => h.includes('gran rubro') || h.includes('rubro'));
  const colCatPrin = header.findIndex((h) => h.includes('categoría principal') || h.includes('categoria principal'));
  const colSubcat = header.findIndex((h) => h.includes('subcategoría') || h.includes('subcategoria'));
  const colDesc = header.findIndex((h) => h.includes('artículo') || h.includes('articulo') || h.includes('descripción') || h.includes('descripcion'));
  const colMarca = header.findIndex((h) => h.includes('marca'));
  const colCant = header.findIndex((h) => h.includes('cant'));
  const colPrecioUnit = header.findIndex((h) => h.includes('precio unitario (ars)') || (h.includes('precio') && h.includes('unit')));
  const colPrecioTotArs = header.findIndex((h) => h.includes('precio total (ars)') || h.includes('total ars'));
  const colPrecioTotUsd = header.findIndex((h) => h.includes('precio total (usd)') || h.includes('total usd') || h.includes('en dolares') || h.includes('en dólares'));
  const colObs = header.findIndex((h) => h.includes('estado') || h.includes('observaciones'));
  const colHojaOrig = header.findIndex((h) => h.includes('hoja origen'));

  const items = [];
  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.some((x) => x !== '')) continue;
    const descRaw = colDesc !== -1 ? String(row[colDesc] || '').trim() : '';
    if (!descRaw) continue;

    const skuRaw = colSku !== -1 ? String(row[colSku] || '').trim() : '';
    const tiendaRaw = colTienda !== -1 ? String(row[colTienda] || '').trim() : '';
    const sectorRaw = colSector !== -1 ? String(row[colSector] || '').trim() : 'General';
    const granRubro = colGranRubro !== -1 ? String(row[colGranRubro] || '').trim() : '';
    const catPrin = colCatPrin !== -1 ? String(row[colCatPrin] || '').trim() : '';
    const subcat = colSubcat !== -1 ? String(row[colSubcat] || '').trim() : '';
    const marcaRaw = colMarca !== -1 ? String(row[colMarca] || '').trim() : '';
    const cant = colCant !== -1 ? Math.max(1, parseInt(row[colCant]) || 1) : 1;
    
    let precioUnit = colPrecioUnit !== -1 ? parsearPrecio(row[colPrecioUnit]) : 0;
    const precioTotArs = colPrecioTotArs !== -1 ? parsearPrecio(row[colPrecioTotArs]) : 0;
    if (!precioUnit && precioTotArs) {
      precioUnit = precioTotArs / cant;
    }

    let precioTotUsd = colPrecioTotUsd !== -1 ? parsearPrecio(row[colPrecioTotUsd]) : 0;
    let precioUnitUsd = precioTotUsd ? Math.round((precioTotUsd / cant) * 100) / 100 : (precioUnit ? Math.round((precioUnit / 1511.5) * 100) / 100 : 0);

    const obsRaw = colObs !== -1 ? String(row[colObs] || '').trim() : '';
    const hojaOrig = colHojaOrig !== -1 ? String(row[colHojaOrig] || '').trim() : '';

    const tInfo = normalizarTienda(tiendaRaw);
    const catFinal = formatearCategoria(granRubro || catPrin || 'Muebles y Útiles');

    const esComodato = obsRaw.toLowerCase().includes('comodato') || descRaw.toLowerCase().includes('comodato');
    let estado = 'Bueno';
    if (obsRaw.toLowerCase().includes('inactivo') || obsRaw.toLowerCase().includes('desuso') || obsRaw.toLowerCase().includes('no funciona')) {
      estado = 'Baja';
    }

    const detalles = [];
    if (catPrin && catPrin !== catFinal) detalles.push(`Rubro: ${catPrin}`);
    if (subcat) detalles.push(`Tipo: ${subcat}`);
    if (obsRaw && obsRaw !== 'Estado: ACTIVO') detalles.push(obsRaw);
    if (hojaOrig) detalles.push(`Origen: ${hojaOrig}`);

    items.push({
      hoja: 'Consolidado',
      codigo_sugerido: skuRaw || null,
      nombre: descRaw,
      marca: (marcaRaw && marcaRaw !== 'Genérico / No especificado') ? marcaRaw : null,
      categoria: catFinal,
      subcategoria: subcat || null,
      sector: sectorRaw || 'General',
      cantidad: cant,
      precio_ars: precioUnit,
      precio_usd: precioUnitUsd,
      estado,
      es_comodato: esComodato,
      observaciones: detalles.length > 0 ? detalles.join(' | ') : 'Carga consolidada 2026',
      nombreTienda: tInfo.nombre,
      codigoTienda: tInfo.codigo,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// 5. Proceso Principal
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 IMPORTADOR DE INVENTARIO · PROYECTO LA YUNTA`);
  console.log(`======================================================`);
  console.log(`📂 Archivo: ${fullExcelPath}`);
  console.log(`   Modo: ${isDryRun ? '🟡 SIMULACIÓN (--dry-run, no escribe en BD)' : '🟢 REAL (Guarda en Supabase)'}`);
  if (targetSheet) console.log(`📋 Hoja específica: "${targetSheet}"`);
  console.log(`──────────────────────────────────────────────────────\n`);

  const fileBuffer = fs.readFileSync(fullExcelPath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const todosLosItems = [];
  const tiendasDetectadas = new Map();
  const categoriasDetectadas = new Set();

  // 1. Revisar si hay una hoja consolidada
  let hojaConsolidadaEncontrada = null;
  if (!targetSheet) {
    for (const h of wb.SheetNames) {
      const itemsConsolidados = procesarHojaConsolidada(wb.Sheets[h]);
      if (itemsConsolidados && itemsConsolidados.length > 0) {
        hojaConsolidadaEncontrada = h;
        console.log(`📋 Hoja consolidada detectada: "${h}" con ${itemsConsolidados.length} activos.`);
        for (const item of itemsConsolidados) {
          if (!tiendasDetectadas.has(item.nombreTienda)) {
            tiendasDetectadas.set(item.nombreTienda, {
              nombre: item.nombreTienda,
              codigo: item.codigoTienda,
              sectores: new Set(),
            });
          }
          tiendasDetectadas.get(item.nombreTienda).sectores.add(item.sector);
          categoriasDetectadas.add(item.categoria);
          todosLosItems.push(item);
        }
        break;
      }
    }
  }

  // 2. Si no es consolidada o se pidió una hoja puntual, procesar hoja por hoja
  if (!hojaConsolidadaEncontrada) {
    const hojas = targetSheet ? [targetSheet] : wb.SheetNames;
    for (const hoja of hojas) {
      if (!wb.Sheets[hoja]) {
        console.warn(`⚠️ La hoja "${hoja}" no existe en el archivo.`);
        continue;
      }

      const itemsHoja = procesarHoja(wb.Sheets[hoja], hoja);
      if (itemsHoja.length === 0) continue;

      const infoTienda = normalizarTienda(hoja);

      if (!tiendasDetectadas.has(infoTienda.nombre)) {
        tiendasDetectadas.set(infoTienda.nombre, {
          nombre: infoTienda.nombre,
          codigo: infoTienda.codigo,
          sectores: new Set(),
        });
      }

      const tObj = tiendasDetectadas.get(infoTienda.nombre);

      for (const item of itemsHoja) {
        tObj.sectores.add(item.sector);
        categoriasDetectadas.add(item.categoria);
        todosLosItems.push({
          ...item,
          nombreTienda: infoTienda.nombre,
          codigoTienda: infoTienda.codigo,
        });
      }

      console.log(`  ✓ Hoja "${hoja}" ➔ Tienda "${infoTienda.nombre}" (${infoTienda.codigo}): ${itemsHoja.length} activos detectados.`);
    }
  }

  console.log(`\n📊 RESUMEN GENERAL:`);
  console.log(`  • Tiendas: ${tiendasDetectadas.size} (${Array.from(tiendasDetectadas.keys()).join(', ')})`);
  console.log(`  • Categorías: ${categoriasDetectadas.size} (${Array.from(categoriasDetectadas).join(', ')})`);
  console.log(`  • Total de activos procesados: ${todosLosItems.length}`);

  let totalValorARS = 0;
  for (const it of todosLosItems) {
    totalValorARS += (it.cantidad || 1) * (it.precio_ars || 0);
  }
  console.log(`  • Valuación estimada total: $ ${totalValorARS.toLocaleString('es-AR')}`);

  console.log(`\n🔍 MUESTRA DE ACTIVOS DETECTADOS (Primeros 8):`);
  console.table(
    todosLosItems.slice(0, 8).map((it) => ({
      Tienda: it.nombreTienda,
      Categoría: it.categoria,
      Descripción: it.nombre.slice(0, 32),
      Cant: it.cantidad,
      Sector: it.sector.slice(0, 15),
      'Precio Unit.': `$ ${it.precio_ars.toLocaleString('es-AR')}`,
      'Total ARS': `$ ${(it.cantidad * it.precio_ars).toLocaleString('es-AR')}`,
    }))
  );

  if (isDryRun) {
    console.log(`\n✅ Modo simulación completado (--dry-run). No se modificó la base de datos.\n`);
    return;
  }

  if (!autoConfirm) {
    const rl = readline.createInterface({ input, output });
    const respuesta = await rl.question(`\n❓ ¿Deseas guardar estos ${todosLosItems.length} activos en la base de datos de Supabase? [s/N]: `);
    rl.close();

    const normalizada = respuesta.trim().toLowerCase();
    if (normalizada !== 's' && normalizada !== 'si' && normalizada !== 'y' && normalizada !== 'yes') {
      console.log(`\n🛑 Operación cancelada por el usuario. La base de datos no fue modificada.\n`);
      return;
    }
  }

  // -------------------------------------------------------------------------
  // 6. Inserción en Base de Datos Supabase
  // -------------------------------------------------------------------------
  console.log(`\n⏳ Sincronizando con la base de datos Supabase...`);

  // 6.1) CATEGORÍAS
  console.log(`  [1/4] Sincronizando Categorías...`);
  const { data: categoriasBD, error: errCat } = await supabase.from('categories').select('id, nombre');
  if (errCat) throw new Error('Error al leer categorías: ' + errCat.message);

  const mapaCategorias = new Map();
  for (const c of categoriasBD || []) {
    mapaCategorias.set(c.nombre.toLowerCase().trim(), c.id);
  }

  for (const catNombre of categoriasDetectadas) {
    const key = catNombre.toLowerCase().trim();
    if (!mapaCategorias.has(key)) {
      const { data: nuevaCat, error: errInsCat } = await supabase
        .from('categories')
        .insert({ nombre: catNombre })
        .select('id, nombre')
        .single();
      if (errInsCat) {
        console.warn(`    ⚠️ Aviso en categoría "${catNombre}": ${errInsCat.message}`);
      } else if (nuevaCat) {
        mapaCategorias.set(key, nuevaCat.id);
      }
    }
  }

  // 6.2) TIENDAS
  console.log(`  [2/4] Sincronizando Tiendas...`);
  const { data: tiendasBD, error: errTiendas } = await supabase.from('stores').select('id, nombre, codigo');
  if (errTiendas) throw new Error('Error al leer tiendas: ' + errTiendas.message);

  const mapaTiendas = new Map();
  const codigosTiendaExistentes = new Set();
  for (const t of tiendasBD || []) {
    mapaTiendas.set(t.nombre.toLowerCase().trim(), t.id);
    codigosTiendaExistentes.add(t.codigo.toUpperCase().trim());
  }

  for (const [nombreTienda, info] of tiendasDetectadas) {
    const key = nombreTienda.toLowerCase().trim();
    if (!mapaTiendas.has(key)) {
      let cod = info.codigo;
      let contador = 1;
      while (codigosTiendaExistentes.has(cod)) {
        cod = `${info.codigo.slice(0, 2)}${contador++}`;
      }
      codigosTiendaExistentes.add(cod);

      const { data: nuevaTienda, error: errInsTienda } = await supabase
        .from('stores')
        .insert({
          nombre: nombreTienda,
          codigo: cod,
          estado: 'activa',
        })
        .select('id, nombre, codigo')
        .single();

      if (errInsTienda) {
        console.warn(`    ⚠️ Aviso en tienda "${nombreTienda}": ${errInsTienda.message}`);
      } else if (nuevaTienda) {
        mapaTiendas.set(key, nuevaTienda.id);
        info.id = nuevaTienda.id;
      }
    } else {
      info.id = mapaTiendas.get(key);
    }
  }

  // 6.3) SECTORES
  console.log(`  [3/4] Sincronizando Sectores por Tienda...`);
  const { data: sectoresBD, error: errSectores } = await supabase.from('sectors').select('id, store_id, nombre');
  if (errSectores) throw new Error('Error al leer sectores: ' + errSectores.message);

  const mapaSectores = new Map();
  for (const s of sectoresBD || []) {
    mapaSectores.set(`${s.store_id}_${s.nombre.toLowerCase().trim()}`, s.id);
  }

  for (const [nombreTienda, info] of tiendasDetectadas) {
    const storeId = mapaTiendas.get(nombreTienda.toLowerCase().trim());
    if (!storeId) continue;

    for (const secNombre of info.sectores) {
      const key = `${storeId}_${secNombre.toLowerCase().trim()}`;
      if (!mapaSectores.has(key)) {
        const { data: nuevoSec, error: errInsSec } = await supabase
          .from('sectors')
          .insert({
            store_id: storeId,
            nombre: secNombre,
          })
          .select('id')
          .single();

        if (!errInsSec && nuevoSec) {
          mapaSectores.set(key, nuevoSec.id);
        }
      }
    }
  }

  // 6.4) ACTIVOS (Inserción en Lote)
  console.log(`  [4/4] Insertando Activos e Historial en Supabase...`);

  const { data: codigosExistentesBD } = await supabase.from('assets').select('codigo_interno');
  const setCodigos = new Set((codigosExistentesBD || []).map((a) => a.codigo_interno.toUpperCase()));

  let correlativo = codigosExistentesBD ? codigosExistentesBD.length + 1 : 1;

  const { error: errTestCol } = await supabase.from('assets').select('es_comodato').limit(1);
  const soportaColComodato = !errTestCol;

  const activosParaInsertar = [];
  for (const item of todosLosItems) {
    const storeId = mapaTiendas.get(item.nombreTienda.toLowerCase().trim()) || null;
    const catId = mapaCategorias.get(item.categoria.toLowerCase().trim()) || null;
    const sectorKey = storeId ? `${storeId}_${item.sector.toLowerCase().trim()}` : '';
    const sectorId = mapaSectores.get(sectorKey) || null;

    const prefijoTienda = item.codigoTienda.slice(0, 3).toUpperCase();
    const prefijoCat = item.categoria.slice(0, 3).toUpperCase();
    let sku = item.codigo_sugerido && !setCodigos.has(item.codigo_sugerido.toUpperCase())
      ? item.codigo_sugerido.toUpperCase()
      : `${prefijoTienda}-${prefijoCat}-${String(correlativo).padStart(4, '0')}`;
    while (setCodigos.has(sku)) {
      correlativo++;
      sku = `${prefijoTienda}-${prefijoCat}-${String(correlativo).padStart(4, '0')}`;
    }
    setCodigos.add(sku);
    correlativo++;

    const COTIZACION_USD = 1511.5;
    const precioUsd = item.precio_usd || (item.precio_ars ? Math.round((item.precio_ars / COTIZACION_USD) * 100) / 100 : 0);
    const esComodato = item.es_comodato ?? (item.nombre.toUpperCase().includes('COMODATO') || item.categoria.toUpperCase().includes('COMODATO'));

    const activoObj = {
      codigo_interno: sku,
      nombre: item.nombre,
      marca: item.marca,
      category_id: catId,
      store_id: storeId,
      sector_id: sectorId,
      cantidad: item.cantidad || 1,
      precio_ars: item.precio_ars || 0,
      precio_usd: precioUsd,
      estado: item.estado || 'Bueno',
      observaciones: item.observaciones
        ? (esComodato && !item.observaciones.toLowerCase().includes('comodato') ? `Bien en Comodato | ${item.observaciones}` : item.observaciones)
        : (esComodato ? `Bien en Comodato (Carga inicial desde planilla Excel, Pestaña: ${item.hoja})` : `Carga inicial desde planilla Excel (Pestaña: ${item.hoja})`),
    };
    if (soportaColComodato) {
      activoObj.es_comodato = !!esComodato;
    }

    activosParaInsertar.push(activoObj);
  }

  const BATCH_SIZE = 50;
  let insertados = 0;
  const idsInsertados = [];

  for (let i = 0; i < activosParaInsertar.length; i += BATCH_SIZE) {
    const batch = activosParaInsertar.slice(i, i + BATCH_SIZE);
    const { data: activosCreados, error: errInsBatch } = await supabase
      .from('assets')
      .insert(batch)
      .select('id, store_id, sector_id');

    if (errInsBatch) {
      console.error(`\n❌ Error insertando lote ${i} - ${i + batch.length}:`, errInsBatch.message);
    } else if (activosCreados) {
      insertados += activosCreados.length;
      idsInsertados.push(...activosCreados);
    }
    process.stdout.write(`    ⏳ Insertando activos: ${insertados} / ${activosParaInsertar.length}\r`);
  }

  console.log(`\n    ✓ Insertados ${insertados} activos exitosamente.`);

  // 6.5) Historial de Movimientos de Alta Inicial
  if (idsInsertados.length > 0) {
    console.log(`  Registrando movimientos iniciales de Alta en el historial...`);
    const movimientos = idsInsertados.map((a) => ({
      asset_id: a.id,
      accion: 'Alta',
      observacion: 'Carga inicial masiva desde Excel',
      store_destino_id: a.store_id,
      sector_destino_id: a.sector_id,
    }));

    for (let i = 0; i < movimientos.length; i += BATCH_SIZE) {
      const batchMov = movimientos.slice(i, i + BATCH_SIZE);
      await supabase.from('asset_movements').insert(batchMov);
    }
  }

  // 6.6) Actualizar cotización del dólar en Configuración y registrar en historial
  console.log(`  Actualizando cotización del dólar ($ 1.511,50) en Configuración...`);
  await supabase.from('settings').update({ cotizacion_usd: 1511.5 }).eq('id', 1);
  await supabase.from('exchange_rates').insert({
    fuente: 'Excel La Yunta 2026',
    tipo: 'oficial',
    compra: 1511.5,
    venta: 1511.5,
  });

  console.log(`\n======================================================`);
  console.log(`🎉 ¡IMPORTACIÓN COMPLETADA CON ÉXITO!`);
  console.log(`   ${insertados} activos registrados y disponibles en la app.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('\n❌ Ocurrió un error inesperado durante la ejecución:', err);
  process.exit(1);
});

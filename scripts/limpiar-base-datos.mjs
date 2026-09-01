/**
 * Script para Limpiar Inventario, Tiendas y Catálogos en Supabase
 * Sistema de Inventario · La Yunta
 * 
 * Conserva estrictamente: USERS, ROLES, SETTINGS.
 * Elimina: assets, asset_movements, asset_photos, asset_history, 
 *          printers, printer_movements, sectors, stores, categories, suppliers.
 * 
 * Uso:
 *   node scripts/limpiar-base-datos.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Falta configurar NEXT_PUBLIC_SUPABASE_URL y claves en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function limpiar() {
  console.log(`\n======================================================`);
  console.log(`🧹 LIMPIEZA DE BASE DE DATOS · PROYECTO LA YUNTA`);
  console.log(`======================================================`);
  console.log(`⚠️  Conservando: USERS, ROLES, CONFIGURACIÓN`);
  console.log(`⚠️  Eliminando: Activos, Historial, Tiendas, Sectores, Categorías, Impresoras...`);
  console.log(`──────────────────────────────────────────────────────\n`);

  const tablasAEliminar = [
    { nombre: 'asset_history', desc: 'Historial de auditoría de activos' },
    { nombre: 'asset_photos', desc: 'Fotos de activos' },
    { nombre: 'asset_movements', desc: 'Movimientos de activos' },
    { nombre: 'printer_movements', desc: 'Movimientos de impresoras' },
    { nombre: 'printers', desc: 'Impresoras' },
    { nombre: 'assets', desc: 'Activos / Productos' },
    { nombre: 'sectors', desc: 'Sectores' },
    { nombre: 'stores', desc: 'Tiendas / Sucursales' },
    { nombre: 'categories', desc: 'Categorías' },
    { nombre: 'suppliers', desc: 'Proveedores' },
  ];

  for (const t of tablasAEliminar) {
    process.stdout.write(`  ⏳ Vaciando tabla "${t.nombre}" (${t.desc})... `);
    const { error, count } = await supabase.from(t.nombre).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✓ Limpia`);
    }
  }

  // Verificar usuarios intactos
  const { data: usuarios, error: errUsers } = await supabase.from('users').select('id, nombre, email, role_id');
  if (!errUsers && usuarios) {
    console.log(`\n👥 USUARIOS CONSERVADOS (${usuarios.length}):`);
    for (const u of usuarios) {
      console.log(`   • ${u.nombre} (${u.email}) - Rol: ${u.role_id}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`✅ ¡BASE DE DATOS LIMPIA!`);
  console.log(`   Solo quedaron los usuarios y la estructura base.`);
  console.log(`======================================================\n`);
}

limpiar().catch((err) => {
  console.error('\n❌ Ocurrió un error:', err);
  process.exit(1);
});

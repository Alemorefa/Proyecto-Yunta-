-- ============================================================================
-- Sistema de Inventario · La Yunta — esquema de base de datos (Supabase/Postgres)
-- ============================================================================
-- Pensado 1:1 a partir del modelo que ya usa el prototipo (lib/db.ts, localStorage).
-- Tablas pedidas: users, roles, stores, sectors, categories, assets,
-- asset_movements, asset_history, asset_photos, suppliers, settings,
-- exchange_rates. Se agregan printers / printer_movements porque el módulo
-- de Impresoras ya existe en la app y necesita dónde guardar sus datos.
--
-- Cómo usar: pegar TODO este archivo en Supabase → SQL Editor → Run.
-- Es seguro correrlo de nuevo (usa IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- roles: catálogo simple de roles (admin ve y modifica todo, usuario es
-- mayormente de solo lectura — mismo criterio que ya aplica la app hoy).
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id text primary key,
  descripcion text
);

insert into public.roles (id, descripcion) values
  ('admin', 'Acceso completo: altas, bajas, transferencias, gestión de usuarios y datos'),
  ('usuario', 'Solo lectura: consulta inventario e historial, sin poder modificar')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- users: perfil de cada persona. El id es el MISMO id que genera
-- Supabase Auth (auth.users) al crear la cuenta — así el login real
-- (email + contraseña con hash, hecho por Supabase) queda ligado 1:1 a este
-- perfil con nombre/rol/teléfono.
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  telefono text,
  role_id text not null references public.roles(id) default 'usuario',
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Trigger: cuando alguien se registra con Supabase Auth (auth.users), le
-- crea automáticamente su fila en public.users. El PRIMER usuario que se
-- registre en todo el sistema queda como "admin"; todos los que siguen
-- entran como "usuario" (un admin los puede ascender después desde la
-- pantalla de Usuarios). Esto evita el problema de "nadie puede crear el
-- primer usuario porque las políticas de RLS solo dejan escribir a un admin
-- que todavía no existe".
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nombre, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    case when (select count(*) from public.users) = 0 then 'admin' else 'usuario' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- stores (tiendas)
-- ----------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  direccion text,
  responsable text,
  estado text not null default 'activa' check (estado in ('activa', 'inactiva')),
  observaciones text,
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- sectors (sectores dentro de una tienda: Depósito, Cajas, etc.)
-- ----------------------------------------------------------------------------
create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  nombre text not null,
  unique (store_id, nombre)
);

-- ----------------------------------------------------------------------------
-- categories (categorías de activos)
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

-- ----------------------------------------------------------------------------
-- suppliers (proveedores) — nueva tabla; hoy "proveedor" era texto libre en
-- el activo, ahora queda como catálogo propio y el activo lo referencia.
-- ----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  contacto text,
  telefono text,
  email text,
  observaciones text
);

-- ----------------------------------------------------------------------------
-- assets (activos / inventario)
-- ----------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text not null unique,
  nombre text not null,
  descripcion text,
  category_id uuid references public.categories(id) on delete set null,
  marca text,
  modelo text,
  numero_serie text,
  estado text not null default 'Nuevo'
    check (estado in ('Nuevo', 'Bueno', 'Regular', 'Dañado', 'Irreparable', 'Baja')),
  fecha_compra date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  cantidad integer not null default 1,
  precio_ars numeric(14, 2),
  precio_usd numeric(14, 2),
  store_id uuid references public.stores(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  responsable text,
  observaciones text,
  fecha_creacion timestamptz not null default now(),
  fecha_baja timestamptz,
  motivo_baja text
);

-- ----------------------------------------------------------------------------
-- asset_movements: movimientos "de negocio" del activo (igual al historial
-- que ya se ve en la app: Alta, Transferencia, Baja, etc.)
-- ----------------------------------------------------------------------------
create table if not exists public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  fecha timestamptz not null default now(),
  usuario_id uuid references public.users(id) on delete set null,
  accion text not null
    check (accion in ('Alta', 'Modificación', 'Cambio de estado', 'Cambio de sector', 'Transferencia', 'Baja')),
  observacion text,
  store_origen_id uuid references public.stores(id) on delete set null,
  store_destino_id uuid references public.stores(id) on delete set null,
  sector_origen_id uuid references public.sectors(id) on delete set null,
  sector_destino_id uuid references public.sectors(id) on delete set null
);

-- ----------------------------------------------------------------------------
-- asset_history: auditoría fina, campo por campo (distinta de
-- asset_movements: acá va CADA edición de un campo suelto, útil para
-- trazabilidad completa aunque no sea un "movimiento" de negocio).
-- ----------------------------------------------------------------------------
create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  usuario_id uuid references public.users(id) on delete set null,
  fecha timestamptz not null default now(),
  campo text not null,
  valor_anterior text,
  valor_nuevo text
);

-- ----------------------------------------------------------------------------
-- asset_photos: fotos por activo (antes era un solo foto_url; ahora puede
-- haber varias). Subir el archivo a Supabase Storage y guardar acá la URL.
-- ----------------------------------------------------------------------------
create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  url text not null,
  usuario_id uuid references public.users(id) on delete set null,
  fecha_subida timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- settings: configuración general del negocio (fila única).
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  nombre_negocio text,
  cotizacion_usd numeric(14, 2),
  updated_at timestamptz not null default now()
);

insert into public.settings (id, nombre_negocio) values (1, 'La Yunta')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- exchange_rates: historial de cotizaciones del dólar traídas de DolarApi.com
-- (settings.cotizacion_usd guarda la "actual"; acá queda el historial).
-- ----------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  fuente text not null default 'dolarapi.com',
  tipo text not null default 'oficial',
  compra numeric(14, 2),
  venta numeric(14, 2),
  fecha_cotizacion timestamptz,
  fecha_registro timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- printers / printer_movements: módulo de recargas y cambios de cartucho
-- (ya existe en la app, no estaba en la lista pero hace falta guardarlo).
-- ----------------------------------------------------------------------------
create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  store_id uuid references public.stores(id) on delete set null,
  observaciones text,
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.printer_movements (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('Compra', 'Compra Económica', 'Recarga', 'Reset', 'Otro')),
  observacion text,
  usuario_id uuid references public.users(id) on delete set null
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Regla general (igual a los permisos que ya tiene la app):
--   - Cualquier usuario logueado puede LEER todo.
--   - Solo "admin" puede crear/editar/borrar, EXCEPTO en asset_movements /
--     asset_history / asset_photos / printer_movements donde también
--     bloqueamos a "usuario" para escritura (coincide con que Movimientos
--     es una pantalla admin-only en la app).
-- ============================================================================

create or replace function public.rol_actual()
returns text
language sql
security definer
stable
as $$
  select role_id from public.users where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
as $$
  select public.rol_actual() = 'admin';
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'roles', 'users', 'stores', 'sectors', 'categories', 'suppliers',
      'assets', 'asset_movements', 'asset_history', 'asset_photos',
      'settings', 'exchange_rates', 'printers', 'printer_movements'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Lectura: cualquier usuario autenticado puede ver todo.
-- (Postgres no deja mandarle a EXECUTE dos sentencias juntas separadas por
-- ";", por eso va un EXECUTE por sentencia.)
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'roles', 'users', 'stores', 'sectors', 'categories', 'suppliers',
      'assets', 'asset_movements', 'asset_history', 'asset_photos',
      'settings', 'exchange_rates', 'printers', 'printer_movements'
    ])
  loop
    execute format('drop policy if exists "select_autenticados" on public.%I', t);
    execute format(
      'create policy "select_autenticados" on public.%I for select to authenticated using (true)', t
    );
  end loop;
end $$;

-- Escritura solo-admin: catálogos y configuración.
do $$
declare
  t text;
begin
  for t in
    select unnest(array['stores', 'sectors', 'categories', 'suppliers', 'settings', 'users'])
  loop
    execute format('drop policy if exists "escritura_admin" on public.%I', t);
    execute format(
      'create policy "escritura_admin" on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())',
      t
    );
  end loop;
end $$;

-- Escritura solo-admin: inventario y movimientos (usuario es solo lectura).
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'assets', 'asset_movements', 'asset_history', 'asset_photos',
      'printers', 'printer_movements'
    ])
  loop
    execute format('drop policy if exists "escritura_admin" on public.%I', t);
    execute format(
      'create policy "escritura_admin" on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())',
      t
    );
  end loop;
end $$;

-- exchange_rates: cualquier usuario logueado puede insertar (es solo traer y
-- cachear la cotización pública), pero no editar/borrar historial.
drop policy if exists "insertar_cotizacion" on public.exchange_rates;
create policy "insertar_cotizacion" on public.exchange_rates for insert
  to authenticated with check (true);

-- roles: de solo lectura para todos, nadie escribe desde la app (se
-- administra a mano si hace falta un rol nuevo).

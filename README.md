# Sistema de Inventario · La Yunta

Aplicación web para gestionar el inventario físico (muebles, equipos, insumos e
impresoras) de las sucursales de La Yunta: altas, transferencias entre
tiendas, bajas (totales o parciales), historial completo y usuarios con
roles. Corre sobre **Next.js 14 (App Router) + React 18 + TypeScript +
Tailwind CSS + shadcn/ui**, con **Supabase (Postgres + Auth + Row Level
Security)** como backend real — ya no es un prototipo con los datos en el
navegador: todo vive en la base de datos.

## Stack

- Next.js 14.2 (App Router), React 18.3, TypeScript 5.5
- Tailwind CSS + shadcn/ui (primitivas de Radix)
- Supabase: Postgres, Auth (email + contraseña) y Row Level Security
- SheetJS (`xlsx`) para exportar/importar Excel, `html5-qrcode` para el
  escáner de códigos QR desde el celular
- Gráficos del Dashboard hechos en SVG puro, sin librería de charting

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el backend en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Abrí el **SQL Editor** y pegá todo el contenido de `supabase/schema.sql` →
   Run. Crea las tablas, los roles, las políticas de RLS y los triggers. Es
   seguro volver a correrlo (usa `if not exists` / `on conflict do nothing`).
3. Copiá `.env.example` a `.env.local` y completá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — solo se usa del lado del servidor (rutas
     `app/api/admin/*`, para crear/eliminar usuarios); nunca llega al
     navegador. En Vercel, cargá las tres como variables de entorno del
     proyecto.

### 3. Crear el primer usuario (admin)

El login ya no tiene registro abierto: la pantalla solo ofrece iniciar
sesión o recuperar contraseña. La primera cuenta hay que crearla directo en
Supabase → **Authentication → Add user** (con "Auto Confirm User"
activado). El trigger `handle_new_user` la crea en `public.users` como
`admin` apenas se registra, por ser la primera fila de esa tabla. Para que
además quede marcada como **super admin** (protegida — ver Seguridad más
abajo), volvé a pegar y correr `supabase/schema.sql` una vez que esa cuenta
ya existe: es seguro repetirlo, y la última sentencia del archivo asigna el
super admin a quien tenga la fecha de alta más antigua. De ahí en adelante,
ese admin da de alta a todos los demás desde **Usuarios → Nuevo Usuario**.

### 4. Correr en desarrollo

```bash
npm run dev
```

Abrí http://localhost:3000. (`npm run dev` borra `.next` antes de arrancar
para evitar caché vieja; `npm run build` + `npm run start` arma y sirve la
versión de producción.)

## Qué incluye

- **Inicio**: tarjetas de resumen (tiendas / activos / categorías /
  usuarios) con CTA a cada sección, "Actividad reciente" (últimos 5
  movimientos, con estado vacío si todavía no hay ninguno) y una checklist
  de "Primeros pasos" que desaparece sola cuando ya se completó todo. Atajos
  de teclado **N** (nuevo ítem), **T** (transferencia) y **B** (baja) — solo
  para administradores — y **H** (historial) para cualquiera; se ignoran
  mientras se está escribiendo en un campo, y mantener apretado **Shift**
  muestra la lista completa en pantalla.
- **Modo oscuro, buscador y preferencias**: el toggle de tema, la
  foto/nombre de perfil y el cambio de contraseña viven en **Preferencias**
  (menú del avatar, arriba a la derecha). El buscador global de la topbar
  consulta Supabase directamente (activos, tiendas e impresoras) mientras se
  escribe. Por debajo de ~900px el menú lateral pasa a ser un drawer con
  botón de hamburguesa.
- **Dashboard**: valor total del inventario en ARS y en USD (cada ítem
  guarda su propio precio en cada moneda, no se convierte uno a partir del
  otro), cantidad de activos, sucursales, muebles/equipos/insumos, últimos
  movimientos, activos dados de baja, filtro por sucursal, gráfico de barras
  (activos por categoría) y de dona (estado del inventario) — ambos en SVG
  puro.
- **Tiendas**: alta/edición (solo admin), código, responsable, sectores por
  tienda. Antes de desactivar una tienda o quitar un sector con ítems
  asignados, avisa cuántos hay y pide confirmación.
- **Inventario**: alta rápida con los campos esenciales (descripción,
  tienda, sector, cantidad, precio unitario ARS y USD); el resto (código
  interno, categoría, marca, N° de serie, proveedor, foto, etc.) queda en
  "Detalles adicionales", colapsable. Valida que no se repita un código
  interno y que la fecha de compra no sea futura. Incluye búsqueda, filtros
  por tienda/categoría/estado, paginación ("Cargar más"), transferencia
  entre sucursales, baja total o **baja parcial por cantidad** (para lotes
  como "Cámaras x26", resta unidades sin dar de baja el ítem completo), foto
  por ítem, QR + etiqueta imprimible, escáner de QR con la cámara (solo en
  mobile), exportación a Excel con los filtros aplicados e importación desde
  Excel con vista previa. Los activos de categoría **Impresoras** aparecen
  fusionados en esta misma tabla (sin filas duplicadas) y se pueden editar,
  mover de tienda o dar de baja desde acá — queda sincronizado
  automáticamente con el módulo Impresoras.
- **Impresoras**: recargas y cambios de cartucho por tienda: impresora,
  tienda, fecha (no futura), tipo de movimiento (Compra, Compra Económica,
  Recarga, Reset, Otro) y una columna calculada con los días desde el último
  movimiento de esa impresora. Permite dar de baja/reactivar (sin borrar el
  historial) y mover una impresora de tienda, dejando ambas acciones
  registradas. Cada impresora está vinculada 1 a 1 con un activo de
  categoría "Impresoras" en Inventario; el vínculo se crea solo y después
  ambos lados quedan sincronizados. *Ver nota sobre la columna calculada más
  abajo.*
- **Movimientos**: pantalla admin-only para registrar transferencias,
  cambios de estado y bajas buscando el activo (con filtros de
  tienda/sector/categoría). Si el activo tiene una impresora vinculada,
  transferirlo o darlo de baja mueve/da de baja también la impresora.
- **Historial**: une en una sola tabla filtrable los movimientos de activos
  y los movimientos de impresoras, con búsqueda, filtro por
  tienda/tipo/fecha, paginación y exportación a Excel.
- **Usuarios** (admin-only): ya no hay registro abierto — un admin crea cada
  cuenta con "Nuevo Usuario" eligiendo una contraseña inicial que le pasa a
  la persona. Permite cambiar rol (Administrador/Usuario), activar/desactivar
  y buscar por nombre/email. La cuenta marcada como **super admin** (la
  primera que se creó) no puede ser editada, desactivada ni eliminada por
  otros admins — solo por sí misma o por otro super admin; solo un super
  admin puede eliminar cuentas de forma permanente o nombrar a otro super
  admin.
- **Configuración**: nombre del negocio, cotización USD (a mano o traída con
  un botón desde [DolarApi.com](https://dolarapi.com), con historial
  guardado en `exchange_rates`), gestión de categorías (avisa cuántos
  activos afecta antes de borrar una), backup completo de solo lectura
  (descarga un JSON con todo lo que hoy vive en Supabase — no hay
  "importar"; restaurar algo puntual se hace a mano desde el Table Editor de
  Supabase) y "Cerrar sesión" real.

### ⚠️ A confirmar: lógica de la columna calculada de Impresoras

Sigue siendo una interpretación de los ejemplos de la planilla original (no
la fórmula real), implementada en `calcularMensajeMovimiento` (`lib/db.ts`):

- Primer movimiento de esa impresora → **"No hay registros anteriores"**.
- Si ya hay uno previo → **"{TIPO ANTERIOR}/ Reemplaza recarga = N días
  desde la última vez"**, con N = días entre este movimiento y el anterior.

Conviene confirmar con el equipo si la regla es exactamente esa (¿se compara
contra el último movimiento de cualquier tipo, o solo contra el último
"Recarga"? ¿qué pasa con varios el mismo día?).

## Roles y permisos

Dos roles: **admin** (alta/edición/baja en todo, gestión de usuarios y
configuración) y **usuario** (solo lectura: navega todas las pantallas pero
no ve botones de crear/editar/borrar). El rol se guarda en
`public.users.role_id` y lo asigna un admin desde Usuarios. Además existe la
marca **super admin**, protegida como se explica arriba.

Los permisos no son solo de interfaz: están replicados como políticas de
**Row Level Security** en Postgres (ver más abajo), así que aunque alguien
manipule la app, la base de datos igual rechaza las escrituras que no le
correspondan a su rol.

## Seguridad

- **Autenticación real** con Supabase Auth: las contraseñas quedan hasheadas
  del lado del servidor, nunca se ven en texto plano.
- **Row Level Security** en todas las tablas: cualquier cuenta autenticada y
  activa puede leer; solo `admin` puede escribir, salvo en
  `asset_movements` / `asset_history` / `asset_photos` / `printer_movements`,
  donde también se bloquea a `usuario` (coincide con que Movimientos es
  admin-only en la app). Cada persona puede editar su propia fila en `users`
  (nombre, foto) vía una política aparte, con un trigger que evita que
  alguien se cambie el rol o se reactive a sí mismo por esa puerta.
- **Cuentas desactivadas**: el bloqueo no es solo en el cliente (que cierra
  la sesión sola) — las funciones que evalúan el rol en la base exigen
  `activo = true`, así que ni con un token viejo se puede leer o escribir
  nada estando desactivado.
- **Cabeceras HTTP** (`next.config.mjs`): `X-Frame-Options`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (todo desactivado salvo la cámara, que usa el escáner QR) y
  `Strict-Transport-Security`.
- **Content-Security-Policy** (`middleware.ts`): restringe scripts,
  conexiones e imágenes al propio dominio, Supabase y `api.qrserver.com`
  (genera el QR de las etiquetas), con `worker-src blob:` para el web worker
  del escáner.
- **Pendiente conocido**: la sesión se guarda como token en `localStorage`,
  no en una cookie `httpOnly` (se evaluó la migración, no se implementó).
  Como mitigación parcial, cambiar la contraseña cierra automáticamente
  cualquier otra sesión activa de esa cuenta.

## Estructura del proyecto

```
app/                    Rutas (App Router) — una carpeta por pantalla
  api/admin/            Rutas server-only con la service_role key (crear/eliminar usuarios)
  inventario/, impresoras/, movimientos/, historial/, tiendas/, usuarios/, configuracion/
components/
  layout/               Sidebar, Topbar, AppShell, LoginScreen, diálogos de Preferencias/Atajos
  charts/                Gráficos de barras y dona en SVG puro
  ui/                    Primitivas de shadcn/ui
lib/                    Capa de datos (una función por operación de Supabase) + utilidades
supabase/schema.sql     Esquema completo: tablas, roles, triggers y políticas de RLS
middleware.ts           Content-Security-Policy
next.config.mjs         Cabeceras de seguridad HTTP
```

## Despliegue

Pensado para desplegarse en Vercel: conectar el repo, cargar las tres
variables de entorno de Supabase en Project Settings → Environment
Variables, y build/deploy automáticos en cada push.

## Limitaciones conocidas

- Las fotos (de activos y de perfil) se guardan como base64 directo en la
  base, no en Supabase Storage.
- El QR se genera con un servicio público externo (`api.qrserver.com`),
  requiere internet.
- La cotización del dólar viene de DolarApi.com, una API comunitaria — no es
  el dato oficial del BCRA, no sirve para fines contables/legales.
- No hay exportación a PDF.
- `lib/migracion.ts` (el importador único de localStorage → Supabase, usado
  durante la migración inicial) ya no está enlazado a ninguna pantalla; se
  puede borrar si no hace falta conservarlo.

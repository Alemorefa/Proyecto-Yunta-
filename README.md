# Sistema de Inventario · LY25 BMT (prototipo web)

Prototipo funcional del sistema de inventario para las sucursales de La Yunta,
construido con **Next.js 14 (App Router) + React + TypeScript + TailwindCSS +
shadcn/ui**.

Este prototipo guarda los datos en **localStorage del navegador** (sin
backend todavía) para poder validar rápido el flujo completo: tiendas,
sectores, categorías, activos, transferencias, bajas e historial. Está
modelado para migrar 1:1 a **Supabase (Postgres + Auth + RLS)** cuando el
proyecto pase a la siguiente etapa.

## Instalación

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## Qué incluye

- **Inicio**: accesos rápidos (Nuevo ítem / Transferencia / Baja / Historial)
  con atajos de teclado **N / T / B / H** (se ignoran mientras estás
  escribiendo en un campo), tarjetas de resumen con un CTA a la sección
  correspondiente, "Actividad reciente" (últimos 5 movimientos, con estado
  vacío si todavía no hay ninguno) y una checklist de "Primeros pasos" que
  desaparece sola cuando ya completaste todo.
- **Modo oscuro**: toggle en el menú de usuario (arriba a la derecha),
  preferencia guardada en el navegador y aplicada antes de la hidratación
  para evitar el parpadeo del tema equivocado.
- **Responsive**: por debajo de ~900px el menú lateral pasa a ser un drawer
  (botón de hamburguesa en el encabezado, overlay que cierra al tocar
  afuera).
- **Buscador global** en el encabezado: busca por activo, tienda o
  impresora y te lleva directo al resultado. Junto a la campana hay un
  indicador de "Sincronizado hace Xs" (referido a que ya se guardó en este
  navegador, no a un servidor real todavía).
- **Dashboard**: valor total del inventario (ARS y USD, cada ítem guarda su
  propio precio en cada moneda), cantidad de activos, sucursales,
  muebles/equipos/insumos, últimos movimientos, bajas, filtro por sucursal,
  más un gráfico de barras (activos por categoría) y uno de dona (estado del
  inventario) — hechos en SVG puro, sin librerías de gráficos de terceros.
- **Tiendas**: alta/edición, código, responsable, estado, sectores por
  tienda. Antes de desactivar una tienda con ítems asignados, avisa cuántos
  hay y pide confirmación.
- **Inventario**: botón de **alta rápida** con los campos esenciales
  (descripción, tienda, sector, cantidad, precio unitario ARS y USD) para
  cargar tanto ítems agrupados (ej. "Cámaras x26 unidades") como activos
  únicos; el resto de los campos (código interno, categoría, marca, N° de
  serie, proveedor, foto, etc.) quedan en una sección "Detalles adicionales"
  opcional y colapsable. Valida que no se repita un código interno. Incluye
  búsqueda por descripción/código/N° de serie, paginación ("Cargar más"),
  transferencia entre sucursales y baja (nunca se elimina un ítem, solo
  cambia a estado "Baja"), foto por ítem, QR + etiqueta imprimible (con
  código interno) para cada fila, exportación a Excel con los filtros
  aplicados, e **importación desde Excel con vista previa** (detecta si cada
  fila es un ítem nuevo o actualiza uno existente por código interno, y
  avisa si no encuentra la tienda/sector/categoría mencionados). Se puede
  abrir directo con el diálogo de alta ya abierto vía `/inventario?abrir=nuevo`
  (lo usan los accesos rápidos de Inicio y el buscador global).
- **Impresoras**: módulo nuevo para recargas y cambios de cartucho por
  tienda, replicando la planilla que ya usan (impresora, tienda, fecha, tipo
  de movimiento, observación y una columna calculada con los días desde el
  último movimiento de esa impresora). *Ver nota de advertencia más abajo.*
- **Movimientos**: pantalla operativa para registrar transferencias, cambios
  de estado y bajas de activos buscando el ítem. El tipo de movimiento se
  puede preseleccionar por URL (`?accion=transferencia|estado|baja`).
- **Historial**: registro completo y filtrable de todos los movimientos de
  inventario (se genera automáticamente al crear/editar/transferir/dar de
  baja un ítem), con búsqueda, paginación y exportación a Excel.
- **Usuarios**: alta/edición, rol Administrador/Usuario, búsqueda por
  nombre/email.
- **Configuración**: nombre del negocio, cotización USD, gestión de
  categorías (evita borrar una categoría/sector en uso sin avisar cuántos
  activos afecta), exportar/importar backup en JSON (guarda la fecha del
  último backup para mostrar un aviso debajo del encabezado si pasaron más
  de 7 días sin exportar), rol de sesión simulado.

## ⚠️ A confirmar: lógica de la columna calculada de Impresoras

Definí la fórmula del módulo Impresoras interpretando los ejemplos de la
planilla que compartieron (no vi la fórmula real). Tal como quedó
implementada en `calcularMensajeMovimiento` (`lib/db.ts`):

- Si es el primer movimiento registrado para esa impresora → **"No hay
  registros anteriores"**.
- Si ya hay un movimiento previo de esa misma impresora → **"{TIPO
  ANTERIOR}/ Reemplaza recarga = N días desde la última vez"**, donde N son
  los días entre la fecha de este movimiento y la del movimiento anterior.

Antes de usarlo en serio conviene confirmar con el equipo si esa es
exactamente la regla (¿se compara contra el último movimiento de cualquier
tipo, o solo contra el último "Recarga"? ¿qué pasa si hay varios el mismo
día?) y ajustar esa función si hace falta.

## Roles y sesión (simulado por ahora)

Como todavía no hay backend, en **Configuración** elegís qué usuario (de la
lista de Usuarios) está navegando la app; de ahí sale el nombre que se ve en
el encabezado y el rol (Administrador/Usuario) que define los permisos. Si
todavía no cargaste ningún usuario, hay un ajuste manual de respaldo. El rol
"Usuario" oculta las acciones de edición/alta (solo lectura), tal como pide
la especificación. El botón "Cerrar sesión" del encabezado todavía no hace
nada real (avisa que falta conectar Supabase Auth). Los movimientos e
historial registran el nombre de la sesión activa como "usuario" del
movimiento.

## Próximos pasos (fuera de este prototipo)

- Conectar Supabase: crear las tablas (`stores`, `sectors`, `categories`,
  `assets`, `asset_movements`, `users`) y reemplazar `lib/db.ts` por
  llamadas al cliente de Supabase.
- Autenticación real (Supabase Auth) y políticas de Row Level Security por
  rol; que "Cerrar sesión" cierre sesión de verdad.
- Fotos de activos: hoy se guardan como base64 en localStorage (ok para
  probar, pero no escala); con Supabase pasarían a Storage.
- QR: hoy se genera con un servicio público externo
  (`api.qrserver.com`, requiere internet); se puede reemplazar por una
  librería sin conexión más adelante. Falta el escaneo desde celular.
- Exportación a PDF.

## Integrar al repositorio de GitHub

El repo actual (`Alemorefa/Proyecto-Yunta-`) tiene una versión previa en
HTML/CSS/JS plano en la raíz. Sugerencia: reemplazarla por este proyecto.

```bash
git clone https://github.com/Alemorefa/Proyecto-Yunta-.git
cd Proyecto-Yunta-
git rm -r index.html css js algo.txt   # versión anterior en HTML/CSS/JS
# copiá todo el contenido de esta carpeta (proyecto-yunta-web) aquí
git add .
git commit -m "Migración a Next.js + TypeScript + Tailwind + shadcn/ui"
git push origin main
```

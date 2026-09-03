// Genera el SQL para cargar inventario en Supabase a partir de la planilla
// exportada de Google Sheets.
//
// Busca la planilla en ESTA misma carpeta, así no hay que escribir rutas.
// Lo normal es ejecutarlo con doble click en GENERAR-SQL.bat.
//
// IMPORTANTE: no depende de ningún paquete instalado. Lee CSV con un parser
// propio (unas 30 líneas más abajo) para que esta carpeta se pueda copiar a
// cualquier lado y siga funcionando. Los .xlsx los lee solo si el paquete
// "xlsx" está disponible; si no, avisa que se exporte como CSV.
//
// Por qué existe: cargar cientos de ítems a mano no es opción, y el
// importador de la app se marea con los precios en formato argentino
// ("$6.000,00") cuando la planilla los tiene como texto. Acá se limpian.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { inflateRawSync } from "node:zlib";

const AQUI = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Cómo se puede llamar cada columna en la planilla. El primero que encuentre,
// gana. Si tu planilla usa otro nombre, agregalo a la lista que corresponda.
// ---------------------------------------------------------------------------
const COLUMNAS = {
  nombre: ["item", "Item", "ITEM", "Descripción", "Descripcion", "descripcion", "Nombre", "nombre"],
  sector: ["sector", "Sector", "SECTOR"],
  cantidad: ["cantidad", "Cantidad", "CANTIDAD"],
  precio: ["unitario", "Unitario", "UNITARIO", "Precio unitario ARS", "Precio ARS", "precio", "Precio"],
  categoria: ["categoria", "Categoría", "Categoria", "CATEGORIA"],
  estado: ["estado", "Estado", "ESTADO"],
  observaciones: ["observaciones", "Observaciones", "OBSERVACIONES", "obs"],
  // Columna de totales de la planilla. No se importa (el sistema recalcula
  // cantidad x precio), pero se usa para control: si no coincide con lo
  // recalculado, se avisa. Ahí suele esconderse un dato mal cargado.
  total: ["Columna 5", "columna 5", "total", "Total", "TOTAL", "importe", "Importe", "subtotal", "Subtotal"],
};

// Valores que aparecen en la columna "sector" pero que en realidad son
// anotaciones que alguien escribió, no ubicaciones. Esas filas se apartan
// para revisarlas a mano en vez de crear un sector llamado "se movio a alem".
const NO_SON_SECTORES = [/^se movio/i, /^se mov/i, /^ver$/i, /^revisar/i, /^\?+$/];

// ---------------------------------------------------------------------------
// Lectura de CSV (sin dependencias)
// ---------------------------------------------------------------------------

// Detecta si el archivo usa coma, punto y coma o tabulación como separador,
// mirando cuál aparece más veces en la primera línea.
function detectarSeparador(primeraLinea) {
  const candidatos = [",", ";", "\t"];
  let mejor = ",";
  let max = -1;
  for (const sep of candidatos) {
    const n = primeraLinea.split(sep).length;
    if (n > max) {
      max = n;
      mejor = sep;
    }
  }
  return mejor;
}

// Parser de CSV que respeta los campos entre comillas (un campo puede tener
// comas adentro, y "" representa una comilla literal).
function parsearCSV(texto, sep) {
  const filas = [];
  let fila = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') enComillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas;
}

// Convierte las filas en objetos usando la primera como encabezados.
function aObjetos(filas) {
  if (filas.length === 0) return [];
  const encabezados = filas[0].map((h) => h.trim());
  return filas.slice(1).map((f) => {
    const o = {};
    encabezados.forEach((h, i) => {
      o[h] = f[i] ?? "";
    });
    return o;
  });
}

// ---------------------------------------------------------------------------
// Lectura de .xlsx (sin dependencias)
//
// Un .xlsx es un archivo ZIP que adentro tiene XML. Node ya trae la
// descompresión (zlib), así que alcanza con leer la estructura del ZIP a mano
// y sacar dos archivos: la hoja y la tabla de textos.
// ---------------------------------------------------------------------------

// Recorre el índice del ZIP y devuelve el contenido de los archivos pedidos.
function abrirZip(buffer) {
  // El índice está al final del archivo, después de una firma conocida.
  let finIndice = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 65558; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      finIndice = i;
      break;
    }
  }
  if (finIndice === -1) throw new Error("No parece un archivo .xlsx válido");

  const cantidad = buffer.readUInt16LE(finIndice + 10);
  let pos = buffer.readUInt32LE(finIndice + 16);
  const archivos = new Map();

  for (let n = 0; n < cantidad; n++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break;

    const metodo = buffer.readUInt16LE(pos + 10);
    const tamComprimido = buffer.readUInt32LE(pos + 20);
    const largoNombre = buffer.readUInt16LE(pos + 28);
    const largoExtra = buffer.readUInt16LE(pos + 30);
    const largoComentario = buffer.readUInt16LE(pos + 32);
    const offsetLocal = buffer.readUInt32LE(pos + 42);
    const nombre = buffer.toString("utf8", pos + 46, pos + 46 + largoNombre);

    // El encabezado local mide 30 bytes + nombre + extra; después viene el dato.
    const nombreLocal = buffer.readUInt16LE(offsetLocal + 26);
    const extraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const inicioDato = offsetLocal + 30 + nombreLocal + extraLocal;
    const crudo = buffer.subarray(inicioDato, inicioDato + tamComprimido);

    archivos.set(nombre, metodo === 0 ? crudo : inflateRawSync(crudo));
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }

  return archivos;
}

function decodificarXML(texto) {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&"); // este va último, si no rompe los demás
}

// "A" -> 0, "B" -> 1, "AA" -> 26
function columnaAIndice(letras) {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function leerXLSX(ruta) {
  const zip = abrirZip(readFileSync(ruta));

  // Tabla de textos compartidos: las celdas de texto guardan un índice acá.
  const textos = [];
  const xmlTextos = zip.get("xl/sharedStrings.xml");
  if (xmlTextos) {
    for (const si of xmlTextos.toString("utf8").split("<si>").slice(1)) {
      // Un texto puede venir partido en varios <t> si tiene formato mezclado.
      const partes = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
      textos.push(decodificarXML(partes.join("")));
    }
  }

  // Primera hoja del libro.
  const nombreHoja =
    [...zip.keys()].find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k)) ||
    [...zip.keys()].find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  if (!nombreHoja) throw new Error("El archivo no tiene ninguna hoja");

  const xmlHoja = zip.get(nombreHoja).toString("utf8");
  const filas = [];

  for (const fila of xmlHoja.split("<row").slice(1)) {
    const celdas = [];
    for (const m of fila.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const [, columna, atributos, contenido] = m;
      const tipo = /t="([^"]+)"/.exec(atributos)?.[1];

      let valor;
      if (tipo === "inlineStr") {
        const partes = [...contenido.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
        valor = decodificarXML(partes.join(""));
      } else {
        // El <v> puede traer atributos (Excel agrega xml:space="preserve"
        // cuando el valor empieza o termina con espacio), así que no se puede
        // buscar "<v>" pelado.
        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(contenido)?.[1] ?? "";
        if (tipo === "s") valor = textos[Number(v)] ?? "";
        else if (v === "") valor = "";
        else valor = isNaN(Number(v)) ? decodificarXML(v) : Number(v);
      }

      celdas[columnaAIndice(columna)] = valor;
    }
    // Se rellenan los huecos para que las columnas no se corran.
    for (let i = 0; i < celdas.length; i++) if (celdas[i] === undefined) celdas[i] = "";
    filas.push(celdas);
  }

  return aObjetos(filas.map((f) => f.map((c) => (c === undefined ? "" : c))));
}

// ---------------------------------------------------------------------------

function leerPlanilla(ruta) {
  const ext = extname(ruta).toLowerCase();

  if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
    // Se saca el BOM que mete Excel/Sheets al exportar en UTF-8.
    const texto = readFileSync(ruta, "utf8").replace(/^﻿/, "");
    const primeraLinea = texto.split("\n")[0] ?? "";
    return aObjetos(parsearCSV(texto, detectarSeparador(primeraLinea)));
  }

  if (ext === ".xlsx" || ext === ".xlsm") return leerXLSX(ruta);

  console.error(`\nNo sé leer archivos ${ext}.`);
  console.error("Exportá la planilla como .xlsx o .csv.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Limpieza de datos
// ---------------------------------------------------------------------------

function valorDe(fila, claves) {
  for (const k of claves) {
    if (fila[k] !== undefined && String(fila[k]).trim() !== "") return fila[k];
  }
  return "";
}

// Convierte a número tanto un número real como un texto en formato argentino
// ("$6.000,00" -> 6000).
function limpiarPrecio(valor) {
  if (typeof valor === "number") return valor;
  const texto = String(valor).trim();
  if (!texto) return 0;
  const soloNumero = texto.replace(/[^\d.,-]/g, "");
  // Formato argentino: el punto separa miles y la coma los decimales.
  const normalizado = soloNumero.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

// La cantidad 0 se respeta: en la planilla significa "el ítem está en la
// lista pero físicamente no está" (se devolvió, se movió a otra sucursal,
// etc.). Forzarla a 1 inventaría stock que no existe.
function limpiarCantidad(valor) {
  if (typeof valor === "number") return Math.max(0, Math.round(valor));
  const texto = String(valor).trim();
  if (!texto) return 1; // celda vacía: se asume una unidad
  const n = parseInt(texto.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

// Postgres escapa la comilla simple duplicándola.
const sql = (t) => String(t).replace(/'/g, "''");

// ---------------------------------------------------------------------------
// Buscar la planilla en esta misma carpeta
// ---------------------------------------------------------------------------

const planillas = readdirSync(AQUI).filter(
  (f) => /\.(csv|tsv|xlsx|xlsm|xls)$/i.test(f) && !f.startsWith("~$")
);

if (planillas.length === 0) {
  console.error("\nNo encontré ninguna planilla en esta carpeta:");
  console.error(`   ${AQUI}\n`);
  console.error("Copiá acá el archivo exportado de Google Sheets (.csv o .xlsx)");
  console.error("y volvé a ejecutar.\n");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

let archivo;
if (planillas.length === 1) {
  archivo = planillas[0];
  console.log(`\nPlanilla encontrada: ${archivo}`);
} else {
  console.log("\nHay varias planillas en la carpeta:\n");
  planillas.forEach((f, i) => console.log(`   ${i + 1}) ${f}`));
  const elegido = await rl.question("\n¿Cuál uso? (número): ");
  archivo = planillas[parseInt(elegido, 10) - 1];
  if (!archivo) {
    console.error("\nOpción inválida.\n");
    rl.close();
    process.exit(1);
  }
}

const tienda = (await rl.question("\nNombre de la tienda (igual que en la app): ")).trim();
rl.close();

if (!tienda) {
  console.error("\nHace falta el nombre de la tienda. Cancelado.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Procesar
// ---------------------------------------------------------------------------

const filas = leerPlanilla(join(AQUI, archivo));

const items = [];
const revisar = [];
const sectores = new Set();

for (const fila of filas) {
  const nombre = String(valorDe(fila, COLUMNAS.nombre)).trim();
  if (!nombre) continue; // fila vacía o de totales

  const sector = String(valorDe(fila, COLUMNAS.sector)).trim();
  const crudoTotal = valorDe(fila, COLUMNAS.total);
  const total = crudoTotal === "" ? null : limpiarPrecio(crudoTotal);
  const cantidad = limpiarCantidad(valorDe(fila, COLUMNAS.cantidad));

  let precio = limpiarPrecio(valorDe(fila, COLUMNAS.precio));
  let ajuste = null;

  // Regla 1: si falta el precio unitario pero la planilla trae el total, se
  // deduce dividiendo por la cantidad.
  if (precio === 0 && total !== null && total > 0 && cantidad > 0) {
    precio = total / cantidad;
    ajuste = `precio deducido del total (${total} / ${cantidad})`;
  }

  // Regla 2: si hay unidades pero el total está en cero, el ítem no vale nada
  // (típicamente algo roto que se dejó en la lista). Ojo: NO aplica cuando la
  // cantidad es 0, porque ahí el total da 0 solo y el precio unitario sigue
  // siendo un dato válido de referencia.
  if (total === 0 && cantidad > 0 && precio !== 0) {
    ajuste = `precio puesto en 0 (la planilla lo valúa en 0 pese a tener ${cantidad} unidad/es)`;
    precio = 0;
  }

  const registro = {
    nombre,
    sector,
    cantidad,
    precio,
    categoria: String(valorDe(fila, COLUMNAS.categoria)).trim(),
    estado: String(valorDe(fila, COLUMNAS.estado)).trim() || "Bueno",
    observaciones: String(valorDe(fila, COLUMNAS.observaciones)).trim(),
    totalPlanilla: total,
    ajuste,
  };

  if (sector && NO_SON_SECTORES.some((re) => re.test(sector))) {
    revisar.push(registro);
    continue;
  }

  if (sector) sectores.add(sector);
  items.push(registro);
}

if (items.length === 0) {
  console.error("\nNo encontré ítems para cargar.");
  console.error("Revisá que la primera fila de la planilla tenga los encabezados");
  console.error("(item, sector, cantidad, unitario) y que los datos empiecen abajo.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Armado del SQL
// ---------------------------------------------------------------------------

const listaSectores = [...sectores].sort();

const bloqueSectores = listaSectores.length
  ? `-- 1) Crear los sectores que falten en la tienda.
--    Se puede correr más de una vez: los que ya existen se ignoran.
insert into public.sectors (store_id, nombre)
select (select id from public.stores where nombre = '${sql(tienda)}'), s.nombre
from (values
${listaSectores.map((s) => `  ('${sql(s)}')`).join(",\n")}
) as s(nombre)
on conflict (store_id, nombre) do nothing;
`
  : "-- (la planilla no traía sectores)\n";

const valores = items
  .map(
    (i) =>
      `  ('${sql(i.nombre)}', '${sql(i.sector)}', ${i.cantidad}, ${i.precio}, ` +
      `'${sql(i.estado)}', '${sql(i.categoria)}', '${sql(i.observaciones)}')`
  )
  .join(",\n");

const salida = `-- ===========================================================================
-- Carga de inventario para la tienda: ${tienda}
-- Generado desde: ${archivo}
-- Ítems: ${items.length}   Sectores: ${listaSectores.length}${revisar.length ? `   Filas apartadas: ${revisar.length}` : ""}
--
-- Correr los bloques EN ORDEN. El bloque 2 es un ensayo que no escribe nada:
-- sirve para confirmar que los nombres de tienda y sector coinciden antes de
-- insertar de verdad en el bloque 3.
-- ===========================================================================

${bloqueSectores}
-- ---------------------------------------------------------------------------
-- 2) ENSAYO - no inserta nada. Revisá que ninguna fila tenga store_id o
--    sector_id en NULL: eso significa que ese nombre no existe en el sistema.
-- ---------------------------------------------------------------------------
with datos(nombre, sector, cantidad, precio, estado, categoria, observaciones) as (
  values
${valores}
)
select d.nombre, d.sector, d.cantidad, d.precio,
       s.id as store_id, sec.id as sector_id
from datos d
left join public.stores  s   on lower(s.nombre)   = lower('${sql(tienda)}')
left join public.sectors sec on lower(sec.nombre) = lower(d.sector) and sec.store_id = s.id
order by (sec.id is null) desc, d.sector, d.nombre;

-- ---------------------------------------------------------------------------
-- 3) CARGA REAL - inserta los activos y les registra el movimiento de Alta,
--    igual que si los hubieras cargado desde la app.
-- ---------------------------------------------------------------------------
with datos(nombre, sector, cantidad, precio, estado, categoria, observaciones) as (
  values
${valores}
),
insertados as (
  insert into public.assets
    (codigo_interno, nombre, store_id, sector_id, category_id, cantidad, precio_ars, estado, observaciones)
  select
    'INV-' || lpad(((select count(*) from public.assets) + row_number() over ())::text, 4, '0'),
    d.nombre,
    s.id,
    sec.id,
    cat.id,
    d.cantidad,
    d.precio,
    case when d.estado in ('Nuevo','Bueno','Malo') then d.estado else 'Bueno' end,
    nullif(d.observaciones, '')
  from datos d
  join public.stores s on lower(s.nombre) = lower('${sql(tienda)}')
  left join public.sectors sec on lower(sec.nombre) = lower(d.sector) and sec.store_id = s.id
  left join public.categories cat on lower(cat.nombre) = lower(d.categoria)
  returning id
)
insert into public.asset_movements (asset_id, accion, observacion)
select id, 'Alta', 'Carga inicial desde planilla' from insertados;

-- ---------------------------------------------------------------------------
-- 4) Verificación posterior
-- ---------------------------------------------------------------------------
-- select count(*) as total, sum(cantidad * precio_ars) as valorizado
-- from public.assets where store_id = (select id from public.stores where nombre = '${sql(tienda)}');
${
  revisar.length
    ? `
-- ===========================================================================
-- FILAS APARTADAS - el campo "sector" tenía una anotación en vez de una
-- ubicación. NO están incluidas arriba. Revisalas y cargalas a mano:
${revisar.map((r) => `--   ${r.nombre}  |  sector decia: "${r.sector}"  |  cant ${r.cantidad}  |  $${r.precio}`).join("\n")}
-- ===========================================================================
`
    : ""
}`;

const rutaSalida = join(AQUI, "carga-inventario.sql");
writeFileSync(rutaSalida, salida, "utf8");

// ---------------------------------------------------------------------------
// Resumen en pantalla
// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(60));
console.log(`Tienda                   : ${tienda}`);
console.log(`Items listos para cargar : ${items.length}`);
console.log(`Sectores distintos       : ${listaSectores.length}`);
if (revisar.length) {
  console.log(`Filas apartadas          : ${revisar.length}  (ver el final del .sql)`);
}

const sinPrecio = items.filter((i) => i.precio === 0);
if (sinPrecio.length) {
  console.log(`\nOJO: ${sinPrecio.length} item(s) quedaron con precio 0:`);
  sinPrecio.slice(0, 10).forEach((i) => console.log(`   - ${i.nombre}`));
  if (sinPrecio.length > 10) console.log(`   ... y ${sinPrecio.length - 10} mas`);
}

const enCero = items.filter((i) => i.cantidad === 0);
if (enCero.length) {
  console.log(`\n${enCero.length} item(s) con cantidad 0 (se respeta tal cual):`);
  enCero.slice(0, 10).forEach((i) => console.log(`   - ${i.nombre}`));
}

const sinSector = items.filter((i) => !i.sector);
if (sinSector.length) {
  console.log(`\n${sinSector.length} item(s) sin sector (van a quedar sin ubicacion):`);
  sinSector.slice(0, 10).forEach((i) => console.log(`   - ${i.nombre}`));
}

// Filas donde hizo falta corregir el precio segun las reglas de arriba.
const ajustados = items.filter((i) => i.ajuste);
if (ajustados.length) {
  console.log(`\n${ajustados.length} fila(s) con el precio corregido automaticamente:`);
  ajustados.forEach((i) => console.log(`   - ${i.nombre}\n       ${i.ajuste}`));
}

// Control final contra la columna de totales de la planilla. Despues de
// aplicar las reglas no deberia quedar ninguna descuadrada; si queda alguna,
// es un caso que no contemplamos y hay que mirarlo a mano.
const descuadres = items.filter(
  (i) => i.totalPlanilla !== null && Math.abs(i.totalPlanilla - i.cantidad * i.precio) > 0.5
);
if (descuadres.length) {
  console.log(`\n${"!".repeat(60)}`);
  console.log(`${descuadres.length} fila(s) que siguen sin cuadrar con la columna de`);
  console.log("totales de tu planilla. Revisalas a mano:");
  descuadres.forEach((i) =>
    console.log(
      `   - ${i.nombre}\n       cant ${i.cantidad} x $${i.precio.toLocaleString("es-AR")} = $${(i.cantidad * i.precio).toLocaleString("es-AR")}` +
        `  pero la planilla dice $${i.totalPlanilla.toLocaleString("es-AR")}`
    )
  );
  console.log("!".repeat(60));
}

const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
const totalPlanilla = items.reduce((a, i) => a + (i.totalPlanilla ?? i.cantidad * i.precio), 0);

console.log(`\nValorizado (cantidad x precio) : $${total.toLocaleString("es-AR")}`);
if (Math.abs(total - totalPlanilla) > 0.5) {
  console.log(`Valorizado segun tu planilla   : $${totalPlanilla.toLocaleString("es-AR")}`);
  console.log(`Diferencia                     : $${Math.abs(total - totalPlanilla).toLocaleString("es-AR")}`);
  console.log("(la explican las filas descuadradas de arriba)");
}
console.log("=".repeat(60));
console.log(`\nSQL generado en:\n   ${rutaSalida}\n`);

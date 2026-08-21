// Cálculo del nivel de tóner. Va en un archivo aparte (sin "use client" y
// sin tocar Supabase) porque lo usan los dos lados: los componentes del
// navegador y la ruta del cron que corre en el servidor.
//
// No hay un sensor real: la estimación es por tiempo. Se toma la fecha del
// último movimiento que implica un cartucho nuevo o recargado y se compara
// contra los días que se estima que dura uno (Configuración →
// "Duración estimada del cartucho", un único valor para todas las
// impresoras). El nivel NO se guarda en la base: se calcula al vuelo cada
// vez, así que nunca queda desincronizado con los movimientos reales.

// Tipos mínimos (estructurales) para no arrastrar dependencias de cliente.
export type ImpresoraToner = {
  id: string;
  modelo: string;
  store_id: string;
  activa: boolean;
  usa_toner: boolean;
};

export type MovimientoToner = {
  printer_id: string;
  fecha: string; // yyyy-mm-dd
  tipo: string;
};

// Movimientos que dejan el cartucho lleno de nuevo.
//
// ⚠️ "Reset" quedó AFUERA a propósito: en la planilla puede significar
// resetear el chip contador (la impresora vuelve a imprimir, pero el polvo
// del cartucho es el mismo) o un cambio real. Si para el equipo un Reset
// equivale a cartucho nuevo, agregarlo a esta lista y listo — es el único
// lugar donde hay que tocarlo.
export const TIPOS_CARGA_TONER = ["Compra", "Compra Económica", "Recarga"];

export type EstadoToner =
  // La impresora no lleva cartucho (se marcó así al darla de alta).
  | { tipo: "sin-toner" }
  // Falta configurar los días de duración en Configuración.
  | { tipo: "sin-configurar" }
  // Lleva tóner pero todavía no se registró ninguna carga.
  | { tipo: "sin-datos" }
  | {
      tipo: "ok";
      porcentaje: number; // 0 a 1
      diasTranscurridos: number;
      diasRestantes: number;
      diasEstimados: number;
      desdeMovimiento: string; // yyyy-mm-dd
      agotado: boolean;
    };

export function hoyISO(): string {
  return new Date().toISOString().split("T")[0];
}

// Días entre dos fechas 'yyyy-mm-dd'. Se comparan como fechas puras (sin
// hora ni zona horaria) para que no haya corrimientos de un día.
function diasEntre(desde: string, hasta: string): number {
  const [ay, am, ad] = desde.split("-").map(Number);
  const [by, bm, bd] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function calcularEstadoToner(
  impresora: Pick<ImpresoraToner, "id" | "usa_toner">,
  movimientos: MovimientoToner[],
  diasEstimados: number | null
): EstadoToner {
  if (!impresora.usa_toner) return { tipo: "sin-toner" };
  if (!diasEstimados || diasEstimados <= 0) return { tipo: "sin-configurar" };

  // Última carga de cartucho de esta impresora (ignora movimientos con fecha
  // futura, por si alguien cargó una fecha adelantada por error).
  const hoy = hoyISO();
  const cargas = movimientos
    .filter(
      (m) => m.printer_id === impresora.id && TIPOS_CARGA_TONER.includes(m.tipo) && m.fecha <= hoy
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const ultima = cargas[0];
  if (!ultima) return { tipo: "sin-datos" };

  const diasTranscurridos = Math.max(0, diasEntre(ultima.fecha, hoy));
  const diasRestantes = Math.max(0, diasEstimados - diasTranscurridos);

  return {
    tipo: "ok",
    porcentaje: Math.max(0, Math.min(1, diasRestantes / diasEstimados)),
    diasTranscurridos,
    diasRestantes,
    diasEstimados,
    desdeMovimiento: ultima.fecha,
    agotado: diasRestantes <= 0,
  };
}

// Impresoras activas, con tóner, cuyo cartucho ya se estima agotado. Es lo
// que alimenta la campana de notificaciones y el mail del cron.
export type ImpresoraAgotada<T extends ImpresoraToner = ImpresoraToner> = {
  impresora: T;
  desdeMovimiento: string;
  diasTranscurridos: number;
};

export function impresorasConTonerAgotado<T extends ImpresoraToner>(
  impresoras: T[],
  movimientos: MovimientoToner[],
  diasEstimados: number | null
): ImpresoraAgotada<T>[] {
  const resultado: ImpresoraAgotada<T>[] = [];
  for (const imp of impresoras) {
    if (!imp.activa) continue;
    const estado = calcularEstadoToner(imp, movimientos, diasEstimados);
    if (estado.tipo === "ok" && estado.agotado) {
      resultado.push({
        impresora: imp,
        desdeMovimiento: estado.desdeMovimiento,
        diasTranscurridos: estado.diasTranscurridos,
      });
    }
  }
  return resultado;
}

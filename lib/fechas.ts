// Manejo de fechas "de calendario" (yyyy-mm-dd, sin hora), como las de
// printer_movements.fecha o assets.fecha_compra.
//
// El problema que resuelve: JavaScript interpreta new Date("2026-08-21")
// como medianoche UTC. Al mostrarlo en hora local de Argentina (UTC-3) eso
// da 20/08 a las 21:00 — o sea, un día ANTES. Y al revés: después de las
// 21:00 hora local, toISOString() ya devuelve el día siguiente, así que
// usarlo para "hoy" hace que un movimiento cargado a la noche quede con
// fecha de mañana.
//
// Regla: para fechas sin hora nunca se pasa por new Date() + toISOString()
// ni por toLocaleDateString(). Se arman y se leen como texto.

// La fecha de HOY según el reloj de quien está usando la app (no UTC).
export function hoyISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// La fecha de hace N días, en formato yyyy-mm-dd y en hora local.
export function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function esFechaSinHora(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

// "2026-08-21" -> "21/08/2026", sin pasar por new Date().
export function formatearFechaSinHora(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

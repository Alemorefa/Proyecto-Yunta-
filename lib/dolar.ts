// Cotización del dólar vía DolarApi.com: API pública y gratuita (sin key),
// mantenida por la comunidad (scrapea DolarHoy). No es una fuente oficial
// del BCRA — sirve perfecto para un negocio chico, pero no para fines
// contables/legales que requieran el dato oficial certificado.
// Doc: https://dolarapi.com/docs/argentina/

export type CotizacionDolar = {
  compra: number;
  venta: number;
  fechaActualizacion: string;
};

export async function obtenerCotizacionOficial(): Promise<CotizacionDolar> {
  const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
  if (!res.ok) throw new Error("No se pudo obtener la cotización");
  const data = await res.json();
  return {
    compra: data.compra,
    venta: data.venta,
    fechaActualizacion: data.fechaActualizacion,
  };
}

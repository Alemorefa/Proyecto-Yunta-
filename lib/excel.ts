"use client";

// Exportación genérica a Excel (.xlsx) usando SheetJS.
// Se usa desde Inventario, Historial e Impresoras: cada pantalla arma un
// array de objetos "planos" (una fila = un objeto) y esta función genera el
// archivo y dispara la descarga.

import * as XLSX from "xlsx";

export function exportarExcel(filas: Record<string, unknown>[], nombreArchivo: string, hoja = "Datos") {
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// Lee la primera hoja de un .xlsx/.xls subido por el usuario y la devuelve
// como un array de objetos (una fila = un objeto, claves = encabezados de
// columna). Se usa para la importación con vista previa en Inventario.
export function leerExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const primeraHoja = wb.SheetNames[0];
        const ws = wb.Sheets[primeraHoja];
        const filas = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        resolve(filas);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

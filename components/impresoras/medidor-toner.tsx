"use client";

// Medidor de tóner al estilo del indicador de nafta de un auto: una fila de
// bloquitos que se van apagando a medida que pasan los días desde la última
// carga de cartucho, con "E" (vacío) y "F" (lleno) a los costados.
//
// Es una estimación por tiempo, no una lectura real de la impresora — ver
// lib/toner.ts.

import { Fuel } from "lucide-react";
import type { EstadoToner } from "@/lib/toner";

const SEGMENTOS = 5;

function colorDe(porcentaje: number, agotado: boolean): string {
  if (agotado) return "bg-red-500";
  if (porcentaje <= 0.25) return "bg-red-500";
  if (porcentaje <= 0.5) return "bg-amber-500";
  return "bg-green-500";
}

export function MedidorToner({ estado }: { estado: EstadoToner }) {
  if (estado.tipo === "sin-toner") {
    return <span className="text-xs text-muted-foreground">No lleva</span>;
  }

  if (estado.tipo === "sin-configurar") {
    return (
      <span className="text-xs text-muted-foreground" title="Falta cargar la duración estimada del cartucho en Configuración">
        Sin configurar
      </span>
    );
  }

  if (estado.tipo === "sin-datos") {
    return (
      <span className="text-xs text-muted-foreground" title="Todavía no se registró ninguna compra ni recarga de cartucho">
        Sin registros
      </span>
    );
  }

  // Cuántos bloquitos quedan encendidos. Mientras quede algo de tóner se
  // muestra al menos uno, para distinguir "casi vacío" de "vacío".
  const llenos = estado.agotado ? 0 : Math.max(1, Math.ceil(estado.porcentaje * SEGMENTOS));
  const color = colorDe(estado.porcentaje, estado.agotado);

  const detalle = estado.agotado
    ? `Tóner agotado — pasaron ${estado.diasTranscurridos} días desde la última carga (estimado: ${estado.diasEstimados})`
    : `Quedan ~${estado.diasRestantes} de ${estado.diasEstimados} días · última carga: ${estado.desdeMovimiento}`;

  return (
    <div className="flex items-center gap-1.5" title={detalle}>
      <span className="text-[10px] font-semibold text-muted-foreground">E</span>

      <div className="flex items-end gap-[2px]">
        {Array.from({ length: SEGMENTOS }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-1.5 rounded-[1px] ${i < llenos ? color : "bg-muted-foreground/25"}`}
          />
        ))}
      </div>

      <span className="text-[10px] font-semibold text-muted-foreground">F</span>

      {estado.agotado && <Fuel className="h-3.5 w-3.5 shrink-0 text-red-500" />}

      <span className={`ml-0.5 text-xs tabular-nums ${estado.agotado ? "font-semibold text-red-500" : "text-muted-foreground"}`}>
        {estado.agotado ? "Vacío" : `${estado.diasRestantes}d`}
      </span>
    </div>
  );
}

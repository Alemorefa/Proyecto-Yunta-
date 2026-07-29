"use client";

// Gráfico de barras hecho en SVG/CSS puro, sin librerías externas (no hay
// forma de instalar y probar paquetes nuevos en este entorno, así que se
// evita cualquier dependencia de charting de terceros).

export type BarDatum = { label: string; value: number };

export function BarChart({ data, color = "hsl(var(--primary))" }: { data: BarDatum[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos todavía</p>;
  }

  return (
    <div className="flex h-52 items-end gap-3 overflow-x-auto pb-1">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-foreground">{d.value}</span>
          <div className="flex h-36 w-full items-end">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="max-w-[4.5rem] truncate text-[10px] text-muted-foreground" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

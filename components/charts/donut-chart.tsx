"use client";

// Gráfico de dona en SVG puro (técnica clásica de stroke-dasharray sobre un
// <circle>), sin librerías externas.

export type DonutDatum = { label: string; value: number; color: string };

export function DonutChart({ data, centerLabel }: { data: DonutDatum[]; centerLabel?: string }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos todavía</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
          {data
            .filter((d) => d.value > 0)
            .map((d) => {
              const dash = (d.value / total) * circumference;
              const circle = (
                <circle
                  key={d.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsetAcc}
                />
              );
              offsetAcc += dash;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
          {centerLabel}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

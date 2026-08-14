"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDB, formatDate, valorTotalARS as calcARS, valorTotalUSD as calcUSD, type DB } from "@/lib/db";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";

const COLOR_ESTADO: Record<string, string> = {
  Nuevo: "#22c55e",
  Bueno: "#4ade80",
  Regular: "#f59e0b",
  Dañado: "#f97316",
  Irreparable: "#ef4444",
};

function money(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [data, setData] = useState<DB | null>(null);
  const [filtroTienda, setFiltroTienda] = useState<string>("todas");

  useEffect(() => {
    setData(getDB());
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;

    const activos = data.activos.filter(
      (a) => filtroTienda === "todas" || a.tienda_id === filtroTienda
    );
    const activosVigentes = activos.filter((a) => a.estado !== "Baja");
    const bajas = activos.filter((a) => a.estado === "Baja");

    // Cada ítem guarda su propio precio ARS y precio USD (no se convierte
    // uno a partir del otro), así que los totales son sumas independientes.
    const valorTotalARS = activosVigentes.reduce((acc, a) => acc + calcARS(a), 0);
    const valorTotalUSD = activosVigentes.reduce((acc, a) => acc + calcUSD(a), 0);

    // Las cantidades se suman por unidades (no por líneas de ítem), porque
    // "Cámaras x26" cuenta como 26 activos, no como 1.
    const sumaCantidad = (lista: typeof activosVigentes) =>
      lista.reduce((acc, a) => acc + (a.cantidad || 1), 0);

    const catNombre = (id?: string | null) => data.categorias.find((c) => c.id === id)?.nombre;
    const muebles = sumaCantidad(activosVigentes.filter((a) => catNombre(a.categoria_id) === "Muebles"));
    const insumos = sumaCantidad(activosVigentes.filter((a) => catNombre(a.categoria_id) === "Insumos"));
    const totalUnidades = sumaCantidad(activosVigentes);
    const equipos = totalUnidades - muebles - insumos;

    const activoIds = new Set(activos.map((a) => a.id));
    const ultimosMov = [...data.movimientos]
      .filter((m) => activoIds.has(m.activo_id))
      .reverse()
      .slice(0, 8);

    // Barras: cantidad de unidades por categoría (top 8).
    const porCategoria = new Map<string, number>();
    activosVigentes.forEach((a) => {
      const nombre = catNombre(a.categoria_id) || "Sin categoría";
      porCategoria.set(nombre, (porCategoria.get(nombre) || 0) + (a.cantidad || 1));
    });
    const categoriaData = [...porCategoria.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Dona: distribución por estado (sin contar las bajas, que ya se ven aparte).
    const estadoData = (["Nuevo", "Bueno", "Regular", "Dañado", "Irreparable"] as const).map((estado) => ({
      label: estado,
      value: sumaCantidad(activosVigentes.filter((a) => a.estado === estado)),
      color: COLOR_ESTADO[estado],
    }));

    return {
      valorTotalARS,
      valorTotalUSD,
      totalActivos: totalUnidades,
      totalTiendas: data.tiendas.length,
      muebles,
      insumos,
      equipos,
      bajas,
      ultimosMov,
      categoriaData,
      estadoData,
    };
  }, [data, filtroTienda]);

  if (!data || !stats) return null;

  const cards = [
    { label: "Valor total (ARS)", value: `$ ${money(stats.valorTotalARS)}` },
    { label: "Valor total (USD)", value: `US$ ${money(stats.valorTotalUSD)}` },
    { label: "Total de activos", value: stats.totalActivos },
    { label: "Sucursales", value: stats.totalTiendas },
    { label: "Muebles", value: stats.muebles },
    { label: "Equipos", value: stats.equipos },
    { label: "Insumos", value: stats.insumos },
    { label: "Dados de baja", value: stats.bajas.length },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Panel de Control</h3>
        <Select value={filtroTienda} onValueChange={setFiltroTienda}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por sucursal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {data.tiendas.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={stats.categoriaData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado del inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={stats.estadoData} centerLabel={`${stats.totalActivos}`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.ultimosMov.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Sin movimientos
                    </TableCell>
                  </TableRow>
                )}
                {stats.ultimosMov.map((m) => {
                  const activo = data.activos.find((a) => a.id === m.activo_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{activo ? activo.nombre : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={m.accion === "Baja" ? "destructive" : "secondary"}>{m.accion}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(m.fecha)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activos Dados de Baja</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.bajas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No hay activos dados de baja
                    </TableCell>
                  </TableRow>
                )}
                {stats.bajas.slice(0, 8).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.nombre}</TableCell>
                    <TableCell>{a.motivo_baja || "-"}</TableCell>
                    <TableCell>{a.fecha_baja ? formatDate(a.fecha_baja) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

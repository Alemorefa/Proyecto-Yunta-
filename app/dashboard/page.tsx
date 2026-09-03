"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/db";
import { listarTiendas, listarCategorias, type Tienda, type Categoria } from "@/lib/catalogos";
import { listarActivos, valorTotalARS as calcARS, valorTotalUSD as calcUSD, type Activo } from "@/lib/inventario-data";
import { listarMovimientos, type Movimiento } from "@/lib/movimientos-data";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";

const COLOR_ESTADO: Record<string, string> = {
  Nuevo: "#22c55e",
  Bueno: "#4ade80",
  Malo: "#ef4444",
};

function money(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [activos, setActivos] = useState<Activo[] | null>(null);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [filtroTienda, setFiltroTienda] = useState<string>("todas");

  useEffect(() => {
    Promise.all([listarActivos(), listarTiendas(), listarCategorias(), listarMovimientos()])
      .then(([a, t, c, m]) => {
        setActivos(a);
        setTiendas(t);
        setCategorias(c);
        setMovimientos(m);
      })
      .catch((err) => toast.error("No se pudo cargar el panel: " + (err as Error).message));
  }, []);

  const stats = useMemo(() => {
    if (!activos) return null;

    const activosFiltrados = activos.filter(
      (a) => filtroTienda === "todas" || a.store_id === filtroTienda
    );
    const activosVigentes = activosFiltrados.filter((a) => a.estado !== "Baja");
    const bajas = activosFiltrados.filter((a) => a.estado === "Baja");

    // Cada ítem guarda su propio precio ARS y precio USD (no se convierte
    // uno a partir del otro), así que los totales son sumas independientes.
    const valorTotalARS = activosVigentes.reduce((acc, a) => acc + calcARS(a), 0);
    const valorTotalUSD = activosVigentes.reduce((acc, a) => acc + calcUSD(a), 0);

    // Las cantidades se suman por unidades (no por líneas de ítem), porque
    // "Cámaras x26" cuenta como 26 activos, no como 1.
    // ?? y no ||: la cantidad 0 es válida (el ítem figura pero no está
    // físicamente). Con || el cero contaba como una unidad.
    const sumaCantidad = (lista: typeof activosVigentes) =>
      lista.reduce((acc, a) => acc + (a.cantidad ?? 1), 0);

    const catNombre = (id?: string | null) => categorias.find((c) => c.id === id)?.nombre;
    const muebles = sumaCantidad(activosVigentes.filter((a) => catNombre(a.category_id) === "Muebles"));
    const insumos = sumaCantidad(activosVigentes.filter((a) => catNombre(a.category_id) === "Insumos"));
    const totalUnidades = sumaCantidad(activosVigentes);
    const equipos = totalUnidades - muebles - insumos;

    const activoIds = new Set(activosFiltrados.map((a) => a.id));
    const ultimosMov = [...movimientos].filter((m) => activoIds.has(m.asset_id)).slice(0, 8);

    // Barras: cantidad de unidades por categoría (top 8).
    const porCategoria = new Map<string, number>();
    activosVigentes.forEach((a) => {
      const nombre = catNombre(a.category_id) || "Sin categoría";
      porCategoria.set(nombre, (porCategoria.get(nombre) || 0) + (a.cantidad ?? 1));
    });
    const categoriaData = [...porCategoria.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Dona: distribución por estado (sin contar las bajas, que ya se ven aparte).
    const estadoData = (["Nuevo", "Bueno", "Malo"] as const).map((estado) => ({
      label: estado,
      value: sumaCantidad(activosVigentes.filter((a) => a.estado === estado)),
      color: COLOR_ESTADO[estado],
    }));

    return {
      valorTotalARS,
      valorTotalUSD,
      totalActivos: totalUnidades,
      totalTiendas: tiendas.length,
      muebles,
      insumos,
      equipos,
      bajas,
      ultimosMov,
      categoriaData,
      estadoData,
    };
  }, [activos, categorias, tiendas, movimientos, filtroTienda]);

  if (!activos || !stats) return null;

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
            {tiendas.map((t) => (
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
                  const activo = activos.find((a) => a.id === m.asset_id);
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { formatDate, type AccionMovimiento } from "@/lib/db";
import { listarTiendas, type Tienda } from "@/lib/catalogos";
import { listarActivos, type Activo } from "@/lib/inventario-data";
import { listarMovimientos, listarUsuariosBasico, type Movimiento, type UsuarioBasico } from "@/lib/movimientos-data";
import { exportarExcel } from "@/lib/excel";
import { toast } from "sonner";

const ACCIONES: AccionMovimiento[] = ["Alta", "Modificación", "Cambio de estado", "Cambio de sector", "Transferencia", "Baja"];
const PAGE_SIZE = 25;

export default function HistorialPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [activos, setActivos] = useState<Activo[]>([]);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [filtroAccion, setFiltroAccion] = useState("todas");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(PAGE_SIZE);

  useEffect(() => {
    Promise.all([listarMovimientos(), listarActivos(), listarTiendas(), listarUsuariosBasico()])
      .then(([m, a, t, u]) => {
        setMovimientos(m);
        setActivos(a);
        setTiendas(t);
        setUsuarios(u);
      })
      .catch((err) => toast.error("No se pudo cargar el historial: " + (err as Error).message));
  }, []);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, filtroAccion, filtroFecha, busqueda]);

  const movimientosFiltrados = useMemo(() => {
    if (!movimientos) return [];
    let movs = movimientos;
    if (filtroAccion !== "todas") movs = movs.filter((m) => m.accion === filtroAccion);
    if (filtroFecha) movs = movs.filter((m) => m.fecha.startsWith(filtroFecha));
    if (filtroTienda !== "todas") {
      movs = movs.filter((m) => m.store_origen_id === filtroTienda || m.store_destino_id === filtroTienda);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      movs = movs.filter((m) => {
        const activo = activos.find((a) => a.id === m.asset_id);
        return activo && (activo.nombre.toLowerCase().includes(q) || activo.codigo_interno.toLowerCase().includes(q));
      });
    }
    return movs;
  }, [movimientos, activos, filtroTienda, filtroAccion, filtroFecha, busqueda]);

  if (!movimientos) return null;

  const movimientosVisibles = movimientosFiltrados.slice(0, limite);

  const nombreActivo = (id: string) => activos.find((a) => a.id === id)?.nombre || "Activo eliminado";
  const nombreTienda = (id?: string | null) => (id ? tiendas.find((t) => t.id === id)?.nombre : undefined);
  const nombreUsuario = (id: string | null) => (id ? usuarios.find((u) => u.id === id)?.nombre || "-" : "-");

  function limpiarFiltros() {
    setFiltroTienda("todas");
    setFiltroAccion("todas");
    setFiltroFecha("");
    setBusqueda("");
  }

  function exportar() {
    const filas = movimientosFiltrados.map((m) => ({
      Fecha: formatDate(m.fecha),
      Activo: nombreActivo(m.asset_id),
      Acción: m.accion,
      "Tienda origen": nombreTienda(m.store_origen_id) || "",
      "Tienda destino": nombreTienda(m.store_destino_id) || "",
      Usuario: nombreUsuario(m.usuario_id),
      Observación: m.observacion || "",
    }));
    exportarExcel(filas, `historial-movimientos-${new Date().toISOString().split("T")[0]}`, "Historial");
    toast.success("Excel generado");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Historial de Movimientos</h3>
        <Button variant="outline" onClick={exportar}>
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Buscar activo..."
          className="w-56"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select value={filtroTienda} onValueChange={setFiltroTienda}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tienda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las tiendas</SelectItem>
            {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroAccion} onValueChange={setFiltroAccion}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo de acción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los tipos</SelectItem>
            {ACCIONES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-44" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} />
        <Button variant="secondary" onClick={limpiarFiltros}>Limpiar Filtros</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              )}
              {movimientosVisibles.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.fecha)}</TableCell>
                  <TableCell>{nombreActivo(m.asset_id)}</TableCell>
                  <TableCell>
                    <Badge variant={m.accion === "Baja" ? "destructive" : m.accion === "Alta" ? "success" : "secondary"}>
                      {m.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.store_origen_id || m.store_destino_id
                      ? `${nombreTienda(m.store_origen_id) || "-"} → ${nombreTienda(m.store_destino_id) || "-"}`
                      : "-"}
                  </TableCell>
                  <TableCell>{nombreUsuario(m.usuario_id)}</TableCell>
                  <TableCell>{m.observacion || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {movimientosFiltrados.length > movimientosVisibles.length && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" onClick={() => setLimite((l) => l + PAGE_SIZE)}>
            Cargar más ({movimientosFiltrados.length - movimientosVisibles.length} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}

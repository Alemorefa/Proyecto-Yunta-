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
import { listarImpresoras, listarMovimientosImpresora, type Impresora, type MovimientoImpresora } from "@/lib/impresoras-data";
import { exportarExcel } from "@/lib/excel";
import { toast } from "sonner";

const ACCIONES: AccionMovimiento[] = ["Alta", "Modificación", "Cambio de estado", "Cambio de sector", "Transferencia", "Baja"];
const PAGE_SIZE = 25;

// Fila normalizada para mostrar movimientos de activos y de impresoras en
// la misma tabla — las impresoras tienen su propio historial (recargas,
// reset, etc.) que antes solo se veía en el módulo Impresoras.
type FilaMovimiento = {
  id: string;
  fecha: string;
  itemNombre: string;
  itemCodigo: string;
  accion: string;
  storeOrigenId: string | null;
  storeDestinoId: string | null;
  usuarioId: string | null;
  observacion: string | null;
};

export default function HistorialPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [activos, setActivos] = useState<Activo[]>([]);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [impresoras, setImpresoras] = useState<Impresora[]>([]);
  const [movimientosImpresora, setMovimientosImpresora] = useState<MovimientoImpresora[]>([]);
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [filtroAccion, setFiltroAccion] = useState("todas");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(PAGE_SIZE);

  useEffect(() => {
    Promise.all([
      listarMovimientos(),
      listarActivos(),
      listarTiendas(),
      listarUsuariosBasico(),
      listarImpresoras(),
      listarMovimientosImpresora(),
    ])
      .then(([m, a, t, u, imp, movImp]) => {
        setMovimientos(m);
        setActivos(a);
        setTiendas(t);
        setUsuarios(u);
        setImpresoras(imp);
        setMovimientosImpresora(movImp);
      })
      .catch((err) => toast.error("No se pudo cargar el historial: " + (err as Error).message));
  }, []);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, filtroAccion, filtroFecha, busqueda]);

  const nombreTienda = (id?: string | null) => (id ? tiendas.find((t) => t.id === id)?.nombre : undefined);
  const nombreUsuario = (id: string | null) => (id ? usuarios.find((u) => u.id === id)?.nombre || "-" : "-");

  const todasLasFilas = useMemo((): FilaMovimiento[] => {
    if (!movimientos) return [];
    const filasActivos: FilaMovimiento[] = movimientos.map((m) => {
      const activo = activos.find((a) => a.id === m.asset_id);
      return {
        id: m.id,
        fecha: m.fecha,
        itemNombre: activo?.nombre || "Activo eliminado",
        itemCodigo: activo?.codigo_interno || "",
        accion: m.accion,
        storeOrigenId: m.store_origen_id ?? null,
        storeDestinoId: m.store_destino_id ?? null,
        usuarioId: m.usuario_id,
        observacion: m.observacion,
      };
    });
    const filasImpresoras: FilaMovimiento[] = movimientosImpresora.map((m) => {
      const imp = impresoras.find((i) => i.id === m.printer_id);
      return {
        id: m.id,
        fecha: m.fecha,
        itemNombre: imp ? `Impresora: ${imp.modelo}` : "Impresora eliminada",
        itemCodigo: "",
        accion: m.tipo,
        storeOrigenId: null,
        storeDestinoId: imp?.store_id ?? null,
        usuarioId: m.usuario_id,
        observacion: m.observacion,
      };
    });
    return [...filasActivos, ...filasImpresoras].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientos, activos, movimientosImpresora, impresoras]);

  const movimientosFiltrados = useMemo(() => {
    let filas = todasLasFilas;
    if (filtroAccion !== "todas") filas = filas.filter((f) => f.accion === filtroAccion);
    if (filtroFecha) filas = filas.filter((f) => f.fecha.startsWith(filtroFecha));
    if (filtroTienda !== "todas") {
      filas = filas.filter((f) => f.storeOrigenId === filtroTienda || f.storeDestinoId === filtroTienda);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      filas = filas.filter((f) => f.itemNombre.toLowerCase().includes(q) || f.itemCodigo.toLowerCase().includes(q));
    }
    return filas;
  }, [todasLasFilas, filtroTienda, filtroAccion, filtroFecha, busqueda]);

  if (!movimientos) return null;

  const movimientosVisibles = movimientosFiltrados.slice(0, limite);

  function limpiarFiltros() {
    setFiltroTienda("todas");
    setFiltroAccion("todas");
    setFiltroFecha("");
    setBusqueda("");
  }

  function exportar() {
    const filas = movimientosFiltrados.map((f) => ({
      Fecha: formatDate(f.fecha),
      Activo: f.itemNombre,
      Acción: f.accion,
      "Tienda origen": nombreTienda(f.storeOrigenId) || "",
      "Tienda destino": nombreTienda(f.storeDestinoId) || "",
      Usuario: nombreUsuario(f.usuarioId),
      Observación: f.observacion || "",
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
              {movimientosVisibles.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{formatDate(f.fecha)}</TableCell>
                  <TableCell>{f.itemNombre}</TableCell>
                  <TableCell>
                    <Badge variant={f.accion === "Baja" ? "destructive" : f.accion === "Alta" ? "success" : "secondary"}>
                      {f.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.storeOrigenId || f.storeDestinoId
                      ? `${nombreTienda(f.storeOrigenId) || "-"} → ${nombreTienda(f.storeDestinoId) || "-"}`
                      : "-"}
                  </TableCell>
                  <TableCell>{nombreUsuario(f.usuarioId)}</TableCell>
                  <TableCell>{f.observacion || "-"}</TableCell>
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

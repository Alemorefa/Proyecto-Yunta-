"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Plus, Printer } from "lucide-react";
import {
  getDB,
  saveDB,
  idGen,
  calcularMensajeMovimiento,
  TIPOS_MOVIMIENTO_IMPRESORA,
  type DB,
  type TipoMovimientoImpresora,
} from "@/lib/db";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { exportarExcel } from "@/lib/excel";

function badgeTipo(tipo: TipoMovimientoImpresora) {
  if (tipo === "Compra Económica") return "destructive";
  if (tipo === "Compra") return "warning";
  if (tipo === "Reset") return "success";
  if (tipo === "Recarga") return "info";
  return "secondary";
}

const hoyISO = () => new Date().toISOString().split("T")[0];

const PAGE_SIZE = 25;

export default function ImpresorasPage() {
  const [data, setData] = useState<DB | null>(null);
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(PAGE_SIZE);

  const [openImpresora, setOpenImpresora] = useState(false);
  const [modeloNuevo, setModeloNuevo] = useState("");
  const [tiendaNueva, setTiendaNueva] = useState("");

  const [openMov, setOpenMov] = useState(false);
  const [impresoraId, setImpresoraId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimientoImpresora>("Recarga");
  const [observacion, setObservacion] = useState("");

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  useEffect(() => {
    setData(getDB());
  }, []);

  const impresorasFiltradas = useMemo(() => {
    if (!data) return [];
    const q = busqueda.trim().toLowerCase();
    return data.impresoras.filter((i) => {
      if (filtroTienda !== "todas" && i.tienda_id !== filtroTienda) return false;
      if (q && !i.modelo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filtroTienda, busqueda]);

  const movimientos = useMemo(() => {
    if (!data) return [];
    const impresoraIds = new Set(impresorasFiltradas.map((i) => i.id));
    return [...data.movimientosImpresora]
      .filter((m) => impresoraIds.has(m.impresora_id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [data, impresorasFiltradas]);

  const movimientosVisibles = movimientos.slice(0, limite);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, busqueda]);

  if (!data) return null;

  const nombreTienda = (id: string) => data.tiendas.find((t) => t.id === id)?.nombre || "-";
  const impresora = (id: string) => data.impresoras.find((i) => i.id === id);

  function crearImpresora() {
    if (!modeloNuevo.trim() || !tiendaNueva) {
      toast.error("Modelo y tienda son obligatorios");
      return;
    }
    const db = getDB();
    db.impresoras.push({ id: idGen(), modelo: modeloNuevo.trim(), tienda_id: tiendaNueva });
    saveDB(db);
    setData(db);
    setModeloNuevo("");
    setTiendaNueva("");
    setOpenImpresora(false);
    toast.success("Impresora agregada");
  }

  function abrirRegistrarMovimiento(idImpresora?: string) {
    setImpresoraId(idImpresora || "");
    setFecha(hoyISO());
    setTipo("Recarga");
    setObservacion("");
    setOpenMov(true);
  }

  function guardarMovimiento() {
    if (!impresoraId) {
      toast.error("Selecciona una impresora");
      return;
    }
    const db = getDB();
    const id = idGen();
    db.movimientosImpresora.push({
      id,
      impresora_id: impresoraId,
      fecha,
      tipo,
      observacion,
      usuario: sesion.nombre,
    });
    saveDB(db);
    setData(db);
    setOpenMov(false);
    toast.success("Movimiento registrado");
  }

  function exportar() {
    const filas = movimientos.map((m) => {
      const imp = impresora(m.impresora_id);
      return {
        Impresora: imp?.modelo || "-",
        Tienda: imp ? nombreTienda(imp.tienda_id) : "-",
        Fecha: m.fecha,
        "Tipo de movimiento": m.tipo,
        Observación: m.observacion || "",
        Cálculo: calcularMensajeMovimiento(data.movimientosImpresora, m.impresora_id, m.fecha, undefined),
      };
    });
    exportarExcel(filas, `impresoras-movimientos-${hoyISO()}`, "Impresoras");
    toast.success("Excel generado");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Impresoras · Recargas y Cambios de Cartucho</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportar}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
          {esAdmin && (
            <>
              <Button variant="secondary" onClick={() => setOpenImpresora(true)}>
                <Printer className="h-4 w-4" /> Nueva impresora
              </Button>
              <Button onClick={() => abrirRegistrarMovimiento()}>
                <Plus className="h-4 w-4" /> Registrar movimiento
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        La columna &quot;Cálculo&quot; es una interpretación de la planilla original (días desde el último movimiento
        de esa misma impresora). Confirmá con el equipo si la lógica exacta coincide.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por modelo..."
          className="w-56"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select value={filtroTienda} onValueChange={setFiltroTienda}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tienda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las tiendas</SelectItem>
            {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Impresora</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead>Cálculo</TableHead>
                {esAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              )}
              {movimientosVisibles.map((m) => {
                const imp = impresora(m.impresora_id);
                const mensaje = calcularMensajeMovimiento(data.movimientosImpresora, m.impresora_id, m.fecha);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{imp?.modelo || "-"}</TableCell>
                    <TableCell>{imp ? nombreTienda(imp.tienda_id) : "-"}</TableCell>
                    <TableCell>{m.fecha}</TableCell>
                    <TableCell>
                      <Badge variant={badgeTipo(m.tipo)}>{m.tipo}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={m.observacion}>{m.observacion || "-"}</TableCell>
                    <TableCell
                      className={`text-xs ${mensaje === "No hay registros anteriores" ? "text-muted-foreground" : "font-medium"}`}
                    >
                      {mensaje}
                    </TableCell>
                    {esAdmin && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => abrirRegistrarMovimiento(m.impresora_id)}>
                          + Movimiento
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {movimientos.length > movimientosVisibles.length && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" onClick={() => setLimite((l) => l + PAGE_SIZE)}>
            Cargar más ({movimientos.length - movimientosVisibles.length} restantes)
          </Button>
        </div>
      )}

      {/* Nueva impresora */}
      <Dialog open={openImpresora} onOpenChange={setOpenImpresora}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva impresora</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modelo</Label>
              <Input placeholder="Ej: HP 4003dw" value={modeloNuevo} onChange={(e) => setModeloNuevo(e.target.value)} />
            </div>
            <div>
              <Label>Tienda</Label>
              <Select value={tiendaNueva} onValueChange={setTiendaNueva}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenImpresora(false)}>Cancelar</Button>
            <Button onClick={crearImpresora}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar movimiento */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Impresora</Label>
              <Select value={impresoraId} onValueChange={setImpresoraId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {data.impresoras.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.modelo} · {nombreTienda(i.tienda_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.impresoras.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Primero agregá una impresora con el botón &quot;Nueva impresora&quot;.
                </p>
              )}
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de movimiento</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMovimientoImpresora)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MOVIMIENTO_IMPRESORA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observación</Label>
              <Input
                placeholder="Ej: se dejaron 3 toner, fue Gonzalo"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenMov(false)}>Cancelar</Button>
            <Button onClick={guardarMovimiento}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Download, Plus, Printer } from "lucide-react";
import { calcularMensajeMovimiento, TIPOS_MOVIMIENTO_IMPRESORA, type TipoMovimientoImpresora } from "@/lib/db";
import { listarTiendas, type Tienda } from "@/lib/catalogos";
import {
  listarImpresoras,
  crearImpresora,
  listarMovimientosImpresora,
  registrarMovimientoImpresora,
  type Impresora,
  type MovimientoImpresora,
} from "@/lib/impresoras-data";
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

// calcularMensajeMovimiento fue escrito contra la forma local (impresora_id);
// acá adaptamos los movimientos de Supabase (printer_id) a esa forma.
function paraCalculo(movimientos: MovimientoImpresora[]) {
  return movimientos.map((m) => ({
    id: m.id,
    impresora_id: m.printer_id,
    fecha: m.fecha,
    tipo: m.tipo,
    observacion: m.observacion ?? undefined,
  }));
}

export default function ImpresorasPage() {
  const [impresoras, setImpresoras] = useState<Impresora[] | null>(null);
  const [movimientosImpresora, setMovimientosImpresora] = useState<MovimientoImpresora[]>([]);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(PAGE_SIZE);

  const [openImpresora, setOpenImpresora] = useState(false);
  const [modeloNuevo, setModeloNuevo] = useState("");
  const [tiendaNueva, setTiendaNueva] = useState("");
  const [guardandoImpresora, setGuardandoImpresora] = useState(false);

  const [openMov, setOpenMov] = useState(false);
  const [impresoraId, setImpresoraId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimientoImpresora>("Recarga");
  const [observacion, setObservacion] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargar() {
    const [i, m, t] = await Promise.all([listarImpresoras(), listarMovimientosImpresora(), listarTiendas()]);
    setImpresoras(i);
    setMovimientosImpresora(m);
    setTiendas(t);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudo cargar: " + (err as Error).message));
  }, []);

  const impresorasFiltradas = useMemo(() => {
    if (!impresoras) return [];
    const q = busqueda.trim().toLowerCase();
    return impresoras.filter((i) => {
      if (filtroTienda !== "todas" && i.store_id !== filtroTienda) return false;
      if (q && !i.modelo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [impresoras, filtroTienda, busqueda]);

  const movimientos = useMemo(() => {
    const impresoraIds = new Set(impresorasFiltradas.map((i) => i.id));
    return [...movimientosImpresora]
      .filter((m) => impresoraIds.has(m.printer_id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientosImpresora, impresorasFiltradas]);

  const movimientosVisibles = movimientos.slice(0, limite);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, busqueda]);

  if (!impresoras) return null;

  const nombreTienda = (id: string) => tiendas.find((t) => t.id === id)?.nombre || "-";
  const impresora = (id: string) => impresoras.find((i) => i.id === id);

  async function guardarImpresora() {
    if (!modeloNuevo.trim() || !tiendaNueva) {
      toast.error("Modelo y tienda son obligatorios");
      return;
    }
    setGuardandoImpresora(true);
    try {
      await crearImpresora(modeloNuevo.trim(), tiendaNueva);
      await cargar();
      setModeloNuevo("");
      setTiendaNueva("");
      setOpenImpresora(false);
      toast.success("Impresora agregada");
    } catch (err) {
      toast.error("No se pudo agregar la impresora: " + (err as Error).message);
    } finally {
      setGuardandoImpresora(false);
    }
  }

  function abrirRegistrarMovimiento(idImpresora?: string) {
    setImpresoraId(idImpresora || "");
    setFecha(hoyISO());
    setTipo("Recarga");
    setObservacion("");
    setOpenMov(true);
  }

  async function guardarMovimiento() {
    if (!impresoraId) {
      toast.error("Selecciona una impresora");
      return;
    }
    setGuardandoMov(true);
    try {
      await registrarMovimientoImpresora({
        printer_id: impresoraId,
        fecha,
        tipo,
        observacion,
        usuario_id: sesion.usuarioId ?? null,
      });
      await cargar();
      setOpenMov(false);
      toast.success("Movimiento registrado");
    } catch (err) {
      toast.error("No se pudo registrar el movimiento: " + (err as Error).message);
    } finally {
      setGuardandoMov(false);
    }
  }

  function exportar() {
    const calculo = paraCalculo(movimientosImpresora);
    const filas = movimientos.map((m) => {
      const imp = impresora(m.printer_id);
      return {
        Impresora: imp?.modelo || "-",
        Tienda: imp ? nombreTienda(imp.store_id) : "-",
        Fecha: m.fecha,
        "Tipo de movimiento": m.tipo,
        Observación: m.observacion || "",
        Cálculo: calcularMensajeMovimiento(calculo, m.printer_id, m.fecha, undefined),
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
            {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 nav:hidden"></TableHead>
                <TableHead>Impresora</TableHead>
                <TableHead className="hidden nav:table-cell">Tienda</TableHead>
                <TableHead className="hidden nav:table-cell">Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden nav:table-cell">Observación</TableHead>
                <TableHead className="hidden nav:table-cell">Cálculo</TableHead>
                {esAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={esAdmin ? 8 : 7} className="text-center text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              )}
              {movimientosVisibles.map((m) => {
                const imp = impresora(m.printer_id);
                const calculo = paraCalculo(movimientosImpresora);
                const mensaje = calcularMensajeMovimiento(calculo, m.printer_id, m.fecha);
                const expandido = expandidos.has(m.id);
                return (
                  <Fragment key={m.id}>
                    <TableRow>
                      <TableCell className="nav:hidden">
                        <Button size="icon" variant="ghost" onClick={() => toggleExpandido(m.id)}>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>
                      <TableCell>{imp?.modelo || "-"}</TableCell>
                      <TableCell className="hidden nav:table-cell">{imp ? nombreTienda(imp.store_id) : "-"}</TableCell>
                      <TableCell className="hidden nav:table-cell">{m.fecha}</TableCell>
                      <TableCell>
                        <Badge variant={badgeTipo(m.tipo)}>{m.tipo}</Badge>
                      </TableCell>
                      <TableCell className="hidden max-w-[220px] truncate nav:table-cell" title={m.observacion || ""}>
                        {m.observacion || "-"}
                      </TableCell>
                      <TableCell
                        className={`hidden text-xs nav:table-cell ${mensaje === "No hay registros anteriores" ? "text-muted-foreground" : "font-medium"}`}
                      >
                        {mensaje}
                      </TableCell>
                      {esAdmin && (
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => abrirRegistrarMovimiento(m.printer_id)}>
                            + Movimiento
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandido && (
                      <TableRow className="nav:hidden">
                        <TableCell colSpan={esAdmin ? 4 : 3} className="bg-muted/30">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Tienda: </span>
                              {imp ? nombreTienda(imp.store_id) : "-"}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fecha: </span>
                              {m.fecha}
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Observación: </span>
                              {m.observacion || "-"}
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Cálculo: </span>
                              {mensaje}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
                  {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenImpresora(false)}>Cancelar</Button>
            <Button onClick={guardarImpresora} disabled={guardandoImpresora}>
              {guardandoImpresora ? "Guardando..." : "Guardar"}
            </Button>
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
                  {impresoras.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.modelo} · {nombreTienda(i.store_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {impresoras.length === 0 && (
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
            <Button onClick={guardarMovimiento} disabled={guardandoMov}>
              {guardandoMov ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

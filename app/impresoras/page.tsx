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
  cambiarEstadoImpresora,
  moverImpresoraDeTienda,
  type Impresora,
  type MovimientoImpresora,
} from "@/lib/impresoras-data";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { exportarExcel } from "@/lib/excel";
import { sincronizarActivoDesdeImpresora, asegurarActivoParaImpresora } from "@/lib/vinculo-impresoras";

function badgeTipo(tipo: TipoMovimientoImpresora) {
  if (tipo === "Baja") return "destructive";
  if (tipo === "Compra Económica") return "destructive";
  if (tipo === "Compra") return "warning";
  if (tipo === "Reset") return "success";
  if (tipo === "Recarga") return "info";
  if (tipo === "Transferencia") return "secondary";
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
  const [tiendaMov, setTiendaMov] = useState("");
  const [impresoraId, setImpresoraId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoMovimientoImpresora>("Recarga");
  const [observacion, setObservacion] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [bajaImpresora, setBajaImpresora] = useState<Impresora | null>(null);
  const [guardandoBaja, setGuardandoBaja] = useState(false);

  const [moverImpresora, setMoverImpresora] = useState<Impresora | null>(null);
  const [tiendaDestinoMover, setTiendaDestinoMover] = useState("");
  const [guardandoMover, setGuardandoMover] = useState(false);

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
      const nueva = await crearImpresora(modeloNuevo.trim(), tiendaNueva);
      await asegurarActivoParaImpresora(nueva);
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
    const imp = idImpresora ? impresoras?.find((i) => i.id === idImpresora) : undefined;
    setTiendaMov(imp?.store_id || "");
    setImpresoraId(idImpresora || "");
    setFecha(hoyISO());
    setTipo("Recarga");
    setObservacion("");
    setOpenMov(true);
  }

  function cambiarTiendaMov(id: string) {
    setTiendaMov(id);
    // Si la impresora elegida no es de la nueva tienda, se limpia — hay
    // modelos repetidos entre tiendas (ej. HL 1200 en Vélez y en Centro) y
    // no queremos que quede seleccionada la de otra sucursal por error.
    const impActual = impresoras?.find((i) => i.id === impresoraId);
    if (impActual && impActual.store_id !== id) setImpresoraId("");
  }

  const impresorasDeLaTiendaMov = impresoras.filter((i) => i.store_id === tiendaMov && i.activa);

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

  function abrirBajaImpresora(imp: Impresora) {
    setBajaImpresora(imp);
  }

  async function confirmarBajaImpresora() {
    if (!bajaImpresora) return;
    const reactivando = !bajaImpresora.activa;
    setGuardandoBaja(true);
    try {
      await cambiarEstadoImpresora(bajaImpresora.id, reactivando);
      // El historial de movimientos anteriores no se toca — solo se agrega
      // una entrada nueva dejando constancia de la baja/reactivación.
      await registrarMovimientoImpresora({
        printer_id: bajaImpresora.id,
        fecha: hoyISO(),
        tipo: reactivando ? "Otro" : "Baja",
        observacion: reactivando ? "Impresora reactivada" : "Impresora dada de baja",
        usuario_id: sesion.usuarioId ?? null,
      });
      await sincronizarActivoDesdeImpresora(bajaImpresora, { activa: reactivando });
      await cargar();
      setBajaImpresora(null);
      toast.success(reactivando ? "Impresora reactivada" : "Impresora dada de baja");
    } catch (err) {
      toast.error("No se pudo actualizar la impresora: " + (err as Error).message);
    } finally {
      setGuardandoBaja(false);
    }
  }

  function abrirMoverImpresora(imp: Impresora) {
    setMoverImpresora(imp);
    setTiendaDestinoMover(imp.store_id);
  }

  async function confirmarMoverImpresora() {
    if (!moverImpresora || !tiendaDestinoMover) return;
    if (tiendaDestinoMover === moverImpresora.store_id) {
      toast.error("Elegí una tienda distinta a la actual");
      return;
    }
    const tiendaOrigenId = moverImpresora.store_id;
    setGuardandoMover(true);
    try {
      await moverImpresoraDeTienda(moverImpresora.id, tiendaDestinoMover);
      // Igual que con la baja: los movimientos previos quedan tal cual,
      // solo se agrega uno nuevo con el traslado.
      await registrarMovimientoImpresora({
        printer_id: moverImpresora.id,
        fecha: hoyISO(),
        tipo: "Transferencia",
        observacion: `De ${nombreTienda(tiendaOrigenId)} a ${nombreTienda(tiendaDestinoMover)}`,
        usuario_id: sesion.usuarioId ?? null,
      });
      await sincronizarActivoDesdeImpresora(moverImpresora, { store_id: tiendaDestinoMover });
      await cargar();
      setMoverImpresora(null);
      toast.success("Impresora movida de tienda");
    } catch (err) {
      toast.error("No se pudo mover la impresora: " + (err as Error).message);
    } finally {
      setGuardandoMover(false);
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
        Cálculo: calcularMensajeMovimiento(calculo, m.printer_id, m.fecha, m.id),
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

      {esAdmin && (
        <Card className="mb-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impresora</TableHead>
                  <TableHead className="hidden nav:table-cell">Tienda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impresorasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay impresoras cargadas
                    </TableCell>
                  </TableRow>
                )}
                {impresorasFiltradas.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.modelo}</TableCell>
                    <TableCell className="hidden nav:table-cell">{nombreTienda(i.store_id)}</TableCell>
                    <TableCell>
                      <Badge variant={i.activa ? "success" : "destructive"}>{i.activa ? "Activa" : "Baja"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={!i.activa} onClick={() => abrirMoverImpresora(i)}>
                          Mover
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirBajaImpresora(i)}>
                          {i.activa ? "Dar de baja" : "Reactivar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                const mensaje = calcularMensajeMovimiento(calculo, m.printer_id, m.fecha, m.id);
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
              <Label>Tienda</Label>
              <Select value={tiendaMov} onValueChange={cambiarTiendaMov}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impresora</Label>
              <Select value={impresoraId} onValueChange={setImpresoraId} disabled={!tiendaMov}>
                <SelectTrigger>
                  <SelectValue placeholder={tiendaMov ? "Seleccionar" : "Elegí primero una tienda"} />
                </SelectTrigger>
                <SelectContent>
                  {impresorasDeLaTiendaMov.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tiendaMov && impresorasDeLaTiendaMov.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Esa tienda no tiene impresoras cargadas todavía — agregá una con &quot;Nueva impresora&quot;.
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

      {/* Dar de baja / reactivar impresora */}
      <Dialog open={!!bajaImpresora} onOpenChange={(v) => !v && setBajaImpresora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bajaImpresora?.activa ? "Dar de baja" : "Reactivar"} &quot;{bajaImpresora?.modelo}&quot;
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {bajaImpresora?.activa
              ? "Deja de estar disponible para elegir en \"Registrar movimiento\". El historial de movimientos que ya tiene no se modifica."
              : "Vuelve a estar disponible para elegir en \"Registrar movimiento\"."}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBajaImpresora(null)}>Cancelar</Button>
            <Button
              variant={bajaImpresora?.activa ? "destructive" : "default"}
              onClick={confirmarBajaImpresora}
              disabled={guardandoBaja}
            >
              {guardandoBaja ? "Guardando..." : bajaImpresora?.activa ? "Dar de baja" : "Reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mover impresora de tienda */}
      <Dialog open={!!moverImpresora} onOpenChange={(v) => !v && setMoverImpresora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover &quot;{moverImpresora?.modelo}&quot;</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Tienda destino</Label>
            <Select value={tiendaDestinoMover} onValueChange={setTiendaDestinoMover}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMoverImpresora(null)}>Cancelar</Button>
            <Button onClick={confirmarMoverImpresora} disabled={guardandoMover}>
              {guardandoMover ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

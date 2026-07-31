"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ESTADOS_ACTIVO, type EstadoActivo } from "@/lib/db";
import { listarTiendas, listarSectores, type Tienda, type Sector } from "@/lib/catalogos";
import {
  listarActivos,
  transferirActivo,
  cambiarEstadoActivo,
  darDeBajaActivo,
  registrarMovimientoActivo,
  type Activo,
} from "@/lib/inventario-data";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";

type TipoAccion = "Transferencia" | "Cambio de estado" | "Baja";

const ACCION_POR_PARAM: Record<string, TipoAccion> = {
  transferencia: "Transferencia",
  estado: "Cambio de estado",
  baja: "Baja",
};

function MovimientosContenido() {
  const searchParams = useSearchParams();
  const [activos, setActivos] = useState<Activo[] | null>(null);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [activoId, setActivoId] = useState("");
  const [accion, setAccion] = useState<TipoAccion>(
    ACCION_POR_PARAM[searchParams.get("accion") || ""] || "Transferencia"
  );
  const [guardando, setGuardando] = useState(false);

  const [tiendaDestino, setTiendaDestino] = useState("");
  const [sectorDestino, setSectorDestino] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoActivo>("Bueno");
  const [observacion, setObservacion] = useState("");

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargar() {
    const [a, t, s] = await Promise.all([listarActivos(), listarTiendas(), listarSectores()]);
    setActivos(a);
    setTiendas(t);
    setSectores(s);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudo cargar: " + (err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultados = useMemo(() => {
    if (!activos) return [];
    const q = busqueda.trim().toLowerCase();
    const activosVivos = activos.filter((a) => a.estado !== "Baja");
    if (!q) return activosVivos.slice(0, 8);
    return activosVivos
      .filter((a) => a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q))
      .slice(0, 8);
  }, [activos, busqueda]);

  if (!activos) return null;

  const activoSeleccionado = activos.find((a) => a.id === activoId);
  const sectoresDeTienda = (tiendaId: string) => sectores.filter((s) => s.store_id === tiendaId);

  async function ejecutar() {
    if (!activoSeleccionado) {
      toast.error("Selecciona un activo");
      return;
    }
    setGuardando(true);
    try {
      if (accion === "Transferencia") {
        if (!tiendaDestino) {
          toast.error("Selecciona la tienda destino");
          setGuardando(false);
          return;
        }
        const origenTienda = activoSeleccionado.store_id;
        const origenSector = activoSeleccionado.sector_id;
        await transferirActivo(activoSeleccionado.id, { store_id: tiendaDestino, sector_id: sectorDestino || null });
        await registrarMovimientoActivo({
          activo_id: activoSeleccionado.id,
          accion: "Transferencia",
          observacion: observacion || "Transferencia de activo",
          store_origen_id: origenTienda,
          store_destino_id: tiendaDestino,
          sector_origen_id: origenSector,
          sector_destino_id: sectorDestino || null,
          usuario_id: sesion.usuarioId ?? null,
        });
        toast.success("Transferencia registrada");
      } else if (accion === "Cambio de estado") {
        await cambiarEstadoActivo(activoSeleccionado.id, estadoNuevo);
        await registrarMovimientoActivo({
          activo_id: activoSeleccionado.id,
          accion: "Cambio de estado",
          observacion: observacion || `Nuevo estado: ${estadoNuevo}`,
          usuario_id: sesion.usuarioId ?? null,
        });
        toast.success("Estado actualizado");
      } else {
        if (!observacion.trim()) {
          toast.error("Indica el motivo de la baja");
          setGuardando(false);
          return;
        }
        await darDeBajaActivo(activoSeleccionado.id, observacion);
        await registrarMovimientoActivo({
          activo_id: activoSeleccionado.id,
          accion: "Baja",
          observacion: observacion.trim(),
          usuario_id: sesion.usuarioId ?? null,
        });
        toast.success("Activo dado de baja");
      }

      await cargar();
      setActivoId("");
      setObservacion("");
      setBusqueda("");
    } catch (err) {
      toast.error("No se pudo registrar el movimiento: " + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (!esAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Solo los administradores pueden registrar movimientos. Consulta el historial de cada activo en la sección
          Historial.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Buscar activo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Buscar por nombre o código interno..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="space-y-1">
            {resultados.map((a) => (
              <button
                key={a.id}
                onClick={() => setActivoId(a.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${
                  activoId === a.id ? "border-primary bg-accent" : ""
                }`}
              >
                <span>
                  {a.nombre} <span className="text-muted-foreground">({a.codigo_interno})</span>
                </span>
                <Badge variant="secondary">{a.estado}</Badge>
              </button>
            ))}
            {resultados.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Registrar movimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activoSeleccionado && <p className="text-sm text-muted-foreground">Selecciona un activo primero.</p>}
          {activoSeleccionado && (
            <>
              <div>
                <Label>Activo</Label>
                <p className="text-sm font-medium">{activoSeleccionado.nombre}</p>
              </div>
              <div>
                <Label>Tipo de movimiento</Label>
                <Select value={accion} onValueChange={(v) => setAccion(v as TipoAccion)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferencia">Transferencia entre sucursales</SelectItem>
                    <SelectItem value="Cambio de estado">Cambio de estado</SelectItem>
                    <SelectItem value="Baja">Baja de activo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accion === "Transferencia" && (
                <>
                  <div>
                    <Label>Tienda destino</Label>
                    <Select value={tiendaDestino} onValueChange={(v) => { setTiendaDestino(v); setSectorDestino(""); }}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sector destino</Label>
                    <Select value={sectorDestino} onValueChange={setSectorDestino}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {sectoresDeTienda(tiendaDestino).map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {accion === "Cambio de estado" && (
                <div>
                  <Label>Nuevo estado</Label>
                  <Select value={estadoNuevo} onValueChange={(v) => setEstadoNuevo(v as EstadoActivo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_ACTIVO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{accion === "Baja" ? "Motivo" : "Observación"}</Label>
                <Input value={observacion} onChange={(e) => setObservacion(e.target.value)} />
              </div>

              <Button
                className="w-full"
                variant={accion === "Baja" ? "destructive" : "default"}
                onClick={ejecutar}
                disabled={guardando}
              >
                {guardando ? "Guardando..." : `Confirmar ${accion}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MovimientosPage() {
  return (
    <Suspense fallback={null}>
      <MovimientosContenido />
    </Suspense>
  );
}

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
import {
  getDB,
  saveDB,
  now,
  registrarMovimiento,
  ESTADOS_ACTIVO,
  type DB,
  type EstadoActivo,
} from "@/lib/db";
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
  const [data, setData] = useState<DB | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [activoId, setActivoId] = useState("");
  const [accion, setAccion] = useState<TipoAccion>(
    ACCION_POR_PARAM[searchParams.get("accion") || ""] || "Transferencia"
  );

  const [tiendaDestino, setTiendaDestino] = useState("");
  const [sectorDestino, setSectorDestino] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoActivo>("Bueno");
  const [observacion, setObservacion] = useState("");

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  useEffect(() => {
    setData(getDB());
  }, []);

  const resultados = useMemo(() => {
    if (!data) return [];
    const q = busqueda.trim().toLowerCase();
    const activos = data.activos.filter((a) => a.estado !== "Baja");
    if (!q) return activos.slice(0, 8);
    return activos
      .filter((a) => a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q))
      .slice(0, 8);
  }, [data, busqueda]);

  if (!data) return null;

  const activoSeleccionado = data.activos.find((a) => a.id === activoId);
  const sectoresDeTienda = (tiendaId: string) => data.sectores.filter((s) => s.tienda_id === tiendaId);

  function ejecutar() {
    if (!activoSeleccionado) {
      toast.error("Selecciona un activo");
      return;
    }
    const db = getDB();
    const idx = db.activos.findIndex((a) => a.id === activoSeleccionado.id);
    if (idx === -1) return;

    if (accion === "Transferencia") {
      if (!tiendaDestino) { toast.error("Selecciona la tienda destino"); return; }
      const origenTienda = db.activos[idx].tienda_id;
      const origenSector = db.activos[idx].sector_id;
      db.activos[idx].tienda_id = tiendaDestino;
      db.activos[idx].sector_id = sectorDestino || null;
      registrarMovimiento(db, {
        activo_id: activoSeleccionado.id,
        accion: "Transferencia",
        observacion: observacion || "Transferencia de activo",
        tienda_origen_id: origenTienda,
        tienda_destino_id: tiendaDestino,
        sector_origen_id: origenSector,
        sector_destino_id: sectorDestino || null,
        usuario: sesion.nombre,
      });
      toast.success("Transferencia registrada");
    } else if (accion === "Cambio de estado") {
      db.activos[idx].estado = estadoNuevo;
      registrarMovimiento(db, {
        activo_id: activoSeleccionado.id,
        accion: "Cambio de estado",
        observacion: observacion || `Nuevo estado: ${estadoNuevo}`,
        usuario: sesion.nombre,
      });
      toast.success("Estado actualizado");
    } else {
      if (!observacion.trim()) { toast.error("Indica el motivo de la baja"); return; }
      db.activos[idx].estado = "Baja";
      db.activos[idx].fecha_baja = now();
      db.activos[idx].motivo_baja = observacion.trim();
      registrarMovimiento(db, {
        activo_id: activoSeleccionado.id,
        accion: "Baja",
        observacion: observacion.trim(),
        usuario: sesion.nombre,
      });
      toast.success("Activo dado de baja");
    }

    saveDB(db);
    setData(db);
    setActivoId("");
    setObservacion("");
    setBusqueda("");
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
                        {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
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
              >
                Confirmar {accion}
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

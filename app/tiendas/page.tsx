"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Power, X } from "lucide-react";
import { getDB, saveDB, idGen, now, type Tienda, type DB } from "@/lib/db";
import { useRolActivo } from "@/lib/role";

const TIENDA_VACIA = { nombre: "", codigo: "", direccion: "", responsable: "", observaciones: "" };

export default function TiendasPage() {
  const [data, setData] = useState<DB | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(TIENDA_VACIA);
  const [sectoresForm, setSectoresForm] = useState<string[]>([]);
  const [nuevoSector, setNuevoSector] = useState("");
  const { esAdmin } = useRolActivo();

  useEffect(() => {
    setData(getDB());
  }, []);

  if (!data) return null;

  const sectoresDe = (tiendaId: string) => data.sectores.filter((s) => s.tienda_id === tiendaId);

  function abrirNueva() {
    setEditId(null);
    setForm(TIENDA_VACIA);
    setSectoresForm([]);
    setOpen(true);
  }

  function abrirEditar(t: Tienda) {
    setEditId(t.id);
    setForm({
      nombre: t.nombre,
      codigo: t.codigo,
      direccion: t.direccion || "",
      responsable: t.responsable || "",
      observaciones: t.observaciones || "",
    });
    setSectoresForm(sectoresDe(t.id).map((s) => s.nombre));
    setOpen(true);
  }

  function guardar() {
    if (!form.nombre.trim() || !form.codigo.trim()) {
      toast.error("Nombre y código son obligatorios");
      return;
    }
    const db = getDB();
    let tiendaId = editId;

    // Si estamos editando, chequeamos qué sectores se van a quitar (existían
    // antes y ya no están en el formulario) y si tienen ítems asignados.
    if (editId) {
      const sectoresActuales = db.sectores.filter((s) => s.tienda_id === editId);
      const nombresNuevos = new Set(sectoresForm.map((n) => n.trim().toLowerCase()));
      const sectoresAEliminar = sectoresActuales.filter(
        (s) => !nombresNuevos.has(s.nombre.trim().toLowerCase())
      );
      const idsAEliminar = new Set(sectoresAEliminar.map((s) => s.id));
      const activosAfectados = db.activos.filter(
        (a) => a.sector_id && idsAEliminar.has(a.sector_id) && a.estado !== "Baja"
      ).length;
      if (activosAfectados > 0) {
        const confirmado = confirm(
          `Vas a quitar ${sectoresAEliminar.length} sector(es) que tienen ${activosAfectados} ítem(s) de ` +
          `inventario asignados. Esos ítems van a quedar sin sector. ¿Continuar?`
        );
        if (!confirmado) return;
      }
    }

    if (editId) {
      const idx = db.tiendas.findIndex((t) => t.id === editId);
      if (idx !== -1) {
        db.tiendas[idx] = { ...db.tiendas[idx], ...form };
      }
      toast.success("Tienda actualizada");
    } else {
      const nueva: Tienda = {
        id: idGen(),
        estado: "activa",
        fecha_creacion: now(),
        ...form,
      };
      db.tiendas.push(nueva);
      tiendaId = nueva.id;
      toast.success("Tienda creada");
    }

    if (tiendaId) {
      // Conservamos el id de los sectores que ya existían (por nombre) para
      // no romper los ítems que ya los tenían asignados; solo se generan ids
      // nuevos para sectores realmente nuevos.
      const sectoresExistentes = db.sectores.filter((s) => s.tienda_id === tiendaId);
      const existentesPorNombre = new Map(
        sectoresExistentes.map((s) => [s.nombre.trim().toLowerCase(), s])
      );
      const nuevaLista = sectoresForm.map(
        (nombre) => existentesPorNombre.get(nombre.trim().toLowerCase()) || { id: idGen(), tienda_id: tiendaId as string, nombre }
      );
      db.sectores = db.sectores.filter((s) => s.tienda_id !== tiendaId).concat(nuevaLista);

      const idsFinales = new Set(nuevaLista.map((s) => s.id));
      db.activos = db.activos.map((a) =>
        a.tienda_id === tiendaId && a.sector_id && !idsFinales.has(a.sector_id)
          ? { ...a, sector_id: null }
          : a
      );
    }

    saveDB(db);
    setData(db);
    setOpen(false);
  }

  function toggleEstado(t: Tienda) {
    const vaAInactiva = t.estado === "activa";
    if (vaAInactiva) {
      const activosAsignados = data.activos.filter(
        (a) => a.tienda_id === t.id && a.estado !== "Baja"
      ).length;
      if (activosAsignados > 0) {
        const confirmado = confirm(
          `"${t.nombre}" tiene ${activosAsignados} ítem(s) de inventario asignados. ` +
          `Si la desactivás van a seguir apareciendo ahí pero la tienda no se va a poder elegir para altas nuevas. ¿Continuar?`
        );
        if (!confirmado) return;
      }
    }
    const db = getDB();
    const idx = db.tiendas.findIndex((x) => x.id === t.id);
    if (idx === -1) return;
    db.tiendas[idx].estado = vaAInactiva ? "inactiva" : "activa";
    saveDB(db);
    setData(db);
    toast.success(`Tienda ${db.tiendas[idx].estado === "activa" ? "activada" : "desactivada"}`);
  }

  function agregarSector() {
    if (!nuevoSector.trim()) return;
    setSectoresForm((prev) => [...prev, nuevoSector.trim()]);
    setNuevoSector("");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gestión de Tiendas</h3>
        {esAdmin && (
          <Button onClick={abrirNueva}>
            <Plus className="h-4 w-4" /> Nueva Tienda
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Sectores</TableHead>
                <TableHead>Estado</TableHead>
                {esAdmin && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tiendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay tiendas registradas
                  </TableCell>
                </TableRow>
              )}
              {data.tiendas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                  <TableCell>{t.nombre}</TableCell>
                  <TableCell>{t.responsable || "-"}</TableCell>
                  <TableCell>{sectoresDe(t.id).length}</TableCell>
                  <TableCell>
                    <Badge variant={t.estado === "activa" ? "success" : "secondary"}>{t.estado}</Badge>
                  </TableCell>
                  {esAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => abrirEditar(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleEstado(t)}>
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Tienda" : "Nueva Tienda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="responsable">Responsable</Label>
              <Input id="responsable" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input id="observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div>
              <Label>Sectores</Label>
              <div className="mb-2 flex flex-wrap gap-1">
                {sectoresForm.map((s, i) => (
                  <Badge key={`${s}-${i}`} variant="secondary" className="gap-1">
                    {s}
                    <button onClick={() => setSectoresForm((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={nuevoSector}
                  placeholder="Ej: Depósito"
                  onChange={(e) => setNuevoSector(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarSector())}
                />
                <Button type="button" variant="outline" onClick={agregarSector}>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

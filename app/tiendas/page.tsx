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
import { useRolActivo } from "@/lib/role";
import {
  listarTiendas,
  listarSectores,
  crearTienda,
  actualizarTienda,
  cambiarEstadoTienda,
  crearSectores,
  borrarSectores,
  contarActivosPorTienda,
  contarActivosPorSectores,
  type Tienda,
  type Sector,
} from "@/lib/catalogos";

const TIENDA_VACIA = { nombre: "", codigo: "", direccion: "", responsable: "", observaciones: "" };

export default function TiendasPage() {
  const [tiendas, setTiendas] = useState<Tienda[] | null>(null);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(TIENDA_VACIA);
  const [sectoresForm, setSectoresForm] = useState<string[]>([]);
  const [nuevoSector, setNuevoSector] = useState("");
  const [guardando, setGuardando] = useState(false);
  const { esAdmin } = useRolActivo();

  async function cargar() {
    const [t, s] = await Promise.all([listarTiendas(), listarSectores()]);
    setTiendas(t);
    setSectores(s);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudieron cargar las tiendas: " + (err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tiendas) return null;

  const sectoresDe = (tiendaId: string) => sectores.filter((s) => s.store_id === tiendaId);

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

  async function guardar() {
    if (!form.nombre.trim() || !form.codigo.trim()) {
      toast.error("Nombre y código son obligatorios");
      return;
    }

    setGuardando(true);
    try {
      if (editId) {
        // Si estamos editando, nos fijamos qué sectores se van a quitar
        // (existían antes y ya no están en el formulario) y si tienen
        // ítems de inventario asignados, para avisar antes de borrarlos.
        const sectoresActuales = sectoresDe(editId);
        const nombresNuevos = new Set(sectoresForm.map((n) => n.trim().toLowerCase()));
        const sectoresAEliminar = sectoresActuales.filter((s) => !nombresNuevos.has(s.nombre.trim().toLowerCase()));

        if (sectoresAEliminar.length > 0) {
          const activosAfectados = await contarActivosPorSectores(sectoresAEliminar.map((s) => s.id));
          if (activosAfectados > 0) {
            const confirmado = confirm(
              `Vas a quitar ${sectoresAEliminar.length} sector(es) que tienen ${activosAfectados} ítem(s) de ` +
                `inventario asignados. Esos ítems van a quedar sin sector. ¿Continuar?`
            );
            if (!confirmado) {
              setGuardando(false);
              return;
            }
          }
        }

        await actualizarTienda(editId, form);
        if (sectoresAEliminar.length > 0) await borrarSectores(sectoresAEliminar.map((s) => s.id));

        const nombresExistentes = new Set(sectoresActuales.map((s) => s.nombre.trim().toLowerCase()));
        const sectoresACrear = sectoresForm.filter((n) => !nombresExistentes.has(n.trim().toLowerCase()));
        if (sectoresACrear.length > 0) await crearSectores(editId, sectoresACrear);

        toast.success("Tienda actualizada");
      } else {
        const nueva = await crearTienda(form);
        if (sectoresForm.length > 0) await crearSectores(nueva.id, sectoresForm);
        toast.success("Tienda creada");
      }

      await cargar();
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo guardar la tienda: " + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleEstado(t: Tienda) {
    const vaAInactiva = t.estado === "activa";
    if (vaAInactiva) {
      const activosAsignados = await contarActivosPorTienda(t.id);
      if (activosAsignados > 0) {
        const confirmado = confirm(
          `"${t.nombre}" tiene ${activosAsignados} ítem(s) de inventario asignados. ` +
            `Si la desactivás van a seguir apareciendo ahí pero la tienda no se va a poder elegir para altas nuevas. ¿Continuar?`
        );
        if (!confirmado) return;
      }
    }
    try {
      await cambiarEstadoTienda(t.id, vaAInactiva ? "inactiva" : "activa");
      await cargar();
      toast.success(`Tienda ${vaAInactiva ? "desactivada" : "activada"}`);
    } catch (err) {
      toast.error("No se pudo cambiar el estado: " + (err as Error).message);
    }
  }

  function agregarSector() {
    if (!nuevoSector.trim()) return;
    setSectoresForm((prev) => [...prev, nuevoSector.trim()]);
    setNuevoSector("");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                <TableHead>Dirección</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Sectores</TableHead>
                <TableHead>Estado</TableHead>
                {esAdmin && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay tiendas registradas
                  </TableCell>
                </TableRow>
              )}
              {tiendas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                  <TableCell>{t.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{t.direccion || "-"}</TableCell>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Power, ShieldCheck } from "lucide-react";
import type { RolUsuario } from "@/lib/db";
import {
  listarUsuarios,
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  type UsuarioReal,
} from "@/lib/usuarios-data";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";

const CREAR_VACIO = { email: "", nombre: "", telefono: "", role_id: "usuario" as RolUsuario, contrasena: "" };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioReal[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", telefono: "", role_id: "usuario" as RolUsuario });
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [openCrear, setOpenCrear] = useState(false);
  const [formCrear, setFormCrear] = useState(CREAR_VACIO);
  const [creando, setCreando] = useState(false);

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargar() {
    const u = await listarUsuarios();
    setUsuarios(u);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudo cargar los usuarios: " + (err as Error).message));
  }, []);

  if (!usuarios) return null;

  const yoSoySuperAdmin = usuarios.find((u) => u.id === sesion.usuarioId)?.super_admin ?? false;

  const q = busqueda.trim().toLowerCase();
  const usuariosFiltrados = q
    ? usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : usuarios;

  function puedeGestionar(u: UsuarioReal) {
    return !u.super_admin || yoSoySuperAdmin;
  }

  function abrirEditar(u: UsuarioReal) {
    setEditId(u.id);
    setForm({ nombre: u.nombre, telefono: u.telefono || "", role_id: u.role_id });
    setOpen(true);
  }

  async function guardar() {
    if (!editId) return;
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (editId === sesion.usuarioId && form.role_id !== "admin") {
      toast.error("No podés quitarte el rol de administrador a vos mismo");
      return;
    }
    setGuardando(true);
    try {
      await actualizarUsuario(editId, form);
      await cargar();
      toast.success("Usuario actualizado");
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo guardar: " + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(u: UsuarioReal) {
    if (u.id === sesion.usuarioId) {
      toast.error("No podés desactivar tu propia cuenta");
      return;
    }
    if (!puedeGestionar(u)) {
      toast.error("Esta cuenta es super admin, no se puede desactivar");
      return;
    }
    try {
      await cambiarEstadoUsuario(u.id, !u.activo);
      await cargar();
    } catch (err) {
      toast.error("No se pudo actualizar: " + (err as Error).message);
    }
  }

  function abrirCrear() {
    setFormCrear(CREAR_VACIO);
    setOpenCrear(true);
  }

  async function confirmarCrear() {
    if (!formCrear.email.trim() || !formCrear.nombre.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    if (formCrear.contrasena.length < 6) {
      toast.error("La contraseña necesita al menos 6 caracteres");
      return;
    }
    setCreando(true);
    try {
      await crearUsuario(formCrear);
      await cargar();
      toast.success(`Cuenta creada para ${formCrear.email}`);
      setOpenCrear(false);
    } catch (err) {
      toast.error("No se pudo crear: " + (err as Error).message);
    } finally {
      setCreando(false);
    }
  }

  if (!esAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Solo los administradores pueden gestionar usuarios.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        Solo un administrador puede dar de alta cuentas nuevas: usá &quot;Nuevo Usuario&quot;, elegís una
        contraseña inicial y se la pasás a esa persona. Ya no hay registro abierto desde el login.
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Gestión de Usuarios</h3>
        <Button onClick={abrirCrear}>
          <Plus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre o email..."
        className="mb-4 max-w-sm"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {busqueda ? "Sin resultados" : "No hay usuarios registrados"}
                  </TableCell>
                </TableRow>
              )}
              {usuariosFiltrados.map((u) => {
                const gestionable = puedeGestionar(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.nombre}
                      {u.id === sesion.usuarioId && <span className="ml-1 text-xs text-muted-foreground">(vos)</span>}
                      {u.super_admin && (
                        <Badge variant="info" className="ml-2 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Super Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role_id === "admin" ? "info" : "secondary"}>
                        {u.role_id === "admin" ? "Administrador" : "Usuario"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.activo ? "success" : "destructive"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {gestionable ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleActivo(u)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Protegida</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editar usuario existente */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v as RolUsuario })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crear usuario nuevo */}
      <Dialog open={openCrear} onOpenChange={setOpenCrear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input
                value={formCrear.nombre}
                onChange={(e) => setFormCrear({ ...formCrear, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formCrear.email}
                onChange={(e) => setFormCrear({ ...formCrear, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Teléfono (opcional)</Label>
              <Input
                value={formCrear.telefono}
                onChange={(e) => setFormCrear({ ...formCrear, telefono: e.target.value })}
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={formCrear.role_id}
                onValueChange={(v) => setFormCrear({ ...formCrear, role_id: v as RolUsuario })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contraseña inicial</Label>
              <Input
                type="text"
                placeholder="Mínimo 6 caracteres"
                value={formCrear.contrasena}
                onChange={(e) => setFormCrear({ ...formCrear, contrasena: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              La cuenta queda lista al toque. Pasale esta contraseña a la persona por el medio que prefieras (puede
              cambiarla después desde &quot;¿Olvidaste tu contraseña?&quot; en el login).
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenCrear(false)}>Cancelar</Button>
            <Button onClick={confirmarCrear} disabled={creando}>
              {creando ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

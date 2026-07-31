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
import { Pencil, Plus, Power } from "lucide-react";
import { getDB, saveDB, idGen, now, type Usuario, type DB, type RolUsuario } from "@/lib/db";
import { useRolActivo } from "@/lib/role";

const USUARIO_VACIO = { nombre: "", email: "", telefono: "", rol: "usuario" as RolUsuario, contrasena: "" };

export default function UsuariosPage() {
  const [data, setData] = useState<DB | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(USUARIO_VACIO);
  const [busqueda, setBusqueda] = useState("");
  const { esAdmin } = useRolActivo();

  useEffect(() => {
    setData(getDB());
  }, []);

  if (!data) return null;

  const q = busqueda.trim().toLowerCase();
  const usuariosFiltrados = q
    ? data.usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : data.usuarios;

  function abrirNuevo() {
    setEditId(null);
    setForm(USUARIO_VACIO);
    setOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditId(u.id);
    setForm({ nombre: u.nombre, email: u.email, telefono: u.telefono || "", rol: u.rol, contrasena: "" });
    setOpen(true);
  }

  function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    if (!editId && !form.contrasena.trim()) {
      toast.error("Asigná una contraseña para que pueda iniciar sesión");
      return;
    }
    const { contrasena, ...resto } = form;
    const db = getDB();
    if (editId) {
      const idx = db.usuarios.findIndex((u) => u.id === editId);
      if (idx !== -1) {
        db.usuarios[idx] = {
          ...db.usuarios[idx],
          ...resto,
          ...(contrasena.trim() ? { contrasena: contrasena.trim() } : {}),
        };
      }
      toast.success("Usuario actualizado");
    } else {
      db.usuarios.push({ id: idGen(), activo: true, fecha_creacion: now(), contrasena: contrasena.trim(), ...resto });
      toast.success("Usuario creado");
    }
    saveDB(db);
    setData(db);
    setOpen(false);
  }

  function toggleActivo(u: Usuario) {
    const db = getDB();
    const idx = db.usuarios.findIndex((x) => x.id === u.id);
    if (idx === -1) return;
    db.usuarios[idx].activo = !db.usuarios[idx].activo;
    saveDB(db);
    setData(db);
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
        Ojo: esta lista todavía es la vieja (local, en este navegador) y no está conectada a las cuentas reales de
        login (Supabase Auth). Para dar de alta gente de verdad, por ahora tienen que crear su cuenta desde la
        pantalla de login (&quot;Crear una cuenta nueva&quot;). Esta pantalla se migra en el próximo paso.
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Gestión de Usuarios (local, temporal)</h3>
        <Button onClick={abrirNuevo}>
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
              {usuariosFiltrados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.nombre}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.rol === "admin" ? "info" : "secondary"}>
                      {u.rol === "admin" ? "Administrador" : "Usuario"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.activo !== false ? "success" : "destructive"}>
                      {u.activo !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEditar(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleActivo(u)}>
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v as RolUsuario })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={form.contrasena}
                onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                placeholder={editId ? "Dejar en blanco para no cambiarla" : "Necesaria para que pueda ingresar"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

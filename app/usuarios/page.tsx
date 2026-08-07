"use client";

import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, MoreVertical, Pencil, Plus, Power, ShieldCheck, Trash2 } from "lucide-react";
import type { RolUsuario } from "@/lib/db";
import {
  listarUsuarios,
  actualizarUsuario,
  cambiarEstadoUsuario,
  cambiarSuperAdmin,
  crearUsuario,
  eliminarUsuario,
  type UsuarioReal,
} from "@/lib/usuarios-data";
import { listarTiendas, type Tienda } from "@/lib/catalogos";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";

const CREAR_VACIO = {
  email: "",
  nombre: "",
  telefono: "",
  role_id: "usuario" as RolUsuario,
  contrasena: "",
  store_id: null as string | null,
};

// "" en el <Select> representa "todas las tiendas" (store_id null) — los
// componentes de shadcn/Radix no dejan usar value="" en un SelectItem.
const SIN_TIENDA = "__todas__";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioReal[] | null>(null);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    role_id: "usuario" as RolUsuario,
    store_id: null as string | null,
  });
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [openCrear, setOpenCrear] = useState(false);
  const [formCrear, setFormCrear] = useState(CREAR_VACIO);
  const [creando, setCreando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [accionesMenuId, setAccionesMenuId] = useState<string | null>(null);

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
    const [u, t] = await Promise.all([listarUsuarios(), listarTiendas()]);
    setUsuarios(u);
    setTiendas(t);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudo cargar los usuarios: " + (err as Error).message));
  }, []);

  if (!usuarios) return null;

  const yoSoySuperAdmin = usuarios.find((u) => u.id === sesion.usuarioId)?.super_admin ?? false;

  function nombreTienda(storeId: string | null) {
    if (!storeId) return "Todas las tiendas";
    return tiendas.find((t) => t.id === storeId)?.nombre ?? "Tienda eliminada";
  }

  // Asignar/cambiar la tienda de un admin cambia su alcance — solo el super
  // admin puede tocar ese campo cuando el rol elegido es "admin". Para un
  // "usuario" lo puede tocar cualquier admin, como el resto de sus datos.
  function puedeAsignarTienda(rol: RolUsuario) {
    return rol === "usuario" || yoSoySuperAdmin;
  }

  const q = busqueda.trim().toLowerCase();
  const usuariosFiltrados = q
    ? usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : usuarios;

  function puedeGestionar(u: UsuarioReal) {
    return !u.super_admin || yoSoySuperAdmin;
  }

  function abrirEditar(u: UsuarioReal) {
    setEditId(u.id);
    setForm({ nombre: u.nombre, telefono: u.telefono || "", role_id: u.role_id, store_id: u.store_id });
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

  // Nombrar o sacarle el super admin a otra cuenta. Solo visible/usable por
  // quien ya es super admin (la base también lo exige, esto es nada más
  // para no ofrecer un botón que va a fallar).
  async function toggleSuperAdmin(u: UsuarioReal) {
    if (u.id === sesion.usuarioId) {
      toast.error("No podés cambiarte el super admin a vos mismo desde acá");
      return;
    }
    const accion = u.super_admin ? "sacarle el super admin a" : "nombrar super admin a";
    if (!confirm(`¿Seguro que querés ${accion} ${u.nombre}?`)) return;
    try {
      await cambiarSuperAdmin(u.id, !u.super_admin);
      await cargar();
      toast.success(u.super_admin ? "Ya no es super admin" : "Ahora es super admin");
    } catch (err) {
      toast.error("No se pudo cambiar: " + (err as Error).message);
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

  async function eliminar(u: UsuarioReal) {
    if (u.id === sesion.usuarioId) {
      toast.error("No podés eliminar tu propia cuenta");
      return;
    }
    if (
      !confirm(
        `¿Eliminar la cuenta de ${u.nombre} (${u.email})? Esta acción no se puede deshacer: pierde el acceso y su historial queda a nombre de una cuenta borrada.`
      )
    )
      return;
    setEliminandoId(u.id);
    try {
      await eliminarUsuario(u.id);
      await cargar();
      toast.success("Usuario eliminado");
    } catch (err) {
      toast.error("No se pudo eliminar: " + (err as Error).message);
    } finally {
      setEliminandoId(null);
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
        <CardContent className="p-0 overflow-x-auto max-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 p-1 sm:p-2 nav:hidden"></TableHead>
                <TableHead className="w-12 p-2">Avatar</TableHead>
                <TableHead className="p-2">Nombre</TableHead>
                <TableHead className="p-2">Rol</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Email</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Tienda</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Estado</TableHead>
                <TableHead className="w-10 text-right p-1 sm:p-2">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {busqueda ? "Sin resultados" : "No hay usuarios registrados"}
                  </TableCell>
                </TableRow>
              )}
              {usuariosFiltrados.map((u) => {
                const gestionable = puedeGestionar(u);
                const expandido = expandidos.has(u.id);
                return (
                  <Fragment key={u.id}>
                    <TableRow className={expandido ? "bg-accent/30 dark:bg-zinc-800/50 border-l-4 border-l-primary shadow-sm" : ""}>
                      {/* Botón expansor en mobile */}
                      <TableCell className="w-8 p-1 sm:p-2 nav:hidden">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpandido(u.id)}>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>

                      {/* Avatar */}
                      <TableCell className="w-12 p-2">
                        <div className="h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navy-800)] text-xs font-semibold text-white flex">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt={u.nombre} className="h-full w-full object-cover" />
                          ) : (
                            u.nombre.trim().charAt(0).toUpperCase() || "?"
                          )}
                        </div>
                      </TableCell>

                      {/* Nombre completo */}
                      <TableCell className="p-2 max-w-[130px] sm:max-w-[200px] truncate">
                        <div className="truncate font-medium text-xs sm:text-sm">
                          {u.nombre}
                          {u.id === sesion.usuarioId && <span className="ml-1 text-[10px] text-muted-foreground">(vos)</span>}
                        </div>
                        {u.super_admin && (
                          <Badge variant="info" className="mt-0.5 px-1 py-0 text-[9px] gap-0.5 inline-flex align-middle">
                            <ShieldCheck className="h-2.5 w-2.5" /> Super Admin
                          </Badge>
                        )}
                      </TableCell>

                      {/* Badge de Rol ultracompacto */}
                      <TableCell className="p-2 max-w-[90px] truncate">
                        <Badge
                          variant={u.role_id === "admin" ? "info" : "secondary"}
                          className="px-1.5 py-0.5 text-[10px] font-normal truncate inline-block"
                        >
                          {u.role_id === "admin" ? "Admin" : "Usuario"}
                        </Badge>
                      </TableCell>

                      {/* Columnas ocultas en móviles */}
                      <TableCell className="hidden nav:table-cell p-2 text-xs truncate max-w-[180px]">{u.email}</TableCell>
                      <TableCell className="hidden nav:table-cell p-2 text-xs text-muted-foreground">{nombreTienda(u.store_id)}</TableCell>
                      <TableCell className="hidden nav:table-cell p-2">
                        <Badge variant={u.activo ? "success" : "destructive"}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="w-10 text-right p-1 sm:p-2">
                        {gestionable ? (
                          <>
                            {/* Vista desktop rápida */}
                            <div className="hidden lg:flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditar(u)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleActivo(u)} title={u.activo ? "Desactivar" : "Activar"}>
                                <Power className="h-4 w-4" />
                              </Button>
                              {yoSoySuperAdmin && u.id !== sesion.usuarioId && u.role_id === "admin" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  title={u.super_admin ? "Sacarle el super admin" : "Nombrar super admin"}
                                  onClick={() => toggleSuperAdmin(u)}
                                >
                                  <ShieldCheck className={u.super_admin ? "h-4 w-4 text-blue-500" : "h-4 w-4"} />
                                </Button>
                              )}
                              {yoSoySuperAdmin && u.id !== sesion.usuarioId && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => eliminar(u)}
                                  disabled={eliminandoId === u.id}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {/* Menú flotante de 3 puntos (MoreVertical) opaco */}
                            <div className="relative lg:hidden inline-block text-left">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setAccionesMenuId(accionesMenuId === u.id ? null : u.id)}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              {accionesMenuId === u.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setAccionesMenuId(null)} />
                                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-xl opacity-100 p-1 text-xs">
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                                      onClick={() => {
                                        setAccionesMenuId(null);
                                        abrirEditar(u);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                                      onClick={() => {
                                        setAccionesMenuId(null);
                                        toggleActivo(u);
                                      }}
                                    >
                                      <Power className="h-3.5 w-3.5 text-zinc-400" />
                                      <span>{u.activo ? "Desactivar" : "Activar"}</span>
                                    </button>
                                    {yoSoySuperAdmin && u.id !== sesion.usuarioId && u.role_id === "admin" && (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                                        onClick={() => {
                                          setAccionesMenuId(null);
                                          toggleSuperAdmin(u);
                                        }}
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                                        <span>{u.super_admin ? "Quitar SuperAdmin" : "Hacer SuperAdmin"}</span>
                                      </button>
                                    )}
                                    {yoSoySuperAdmin && u.id !== sesion.usuarioId && (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left text-red-400 hover:text-red-300 transition-colors"
                                        onClick={() => {
                                          setAccionesMenuId(null);
                                          eliminar(u);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Eliminar</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Fila secundaria del panel expandido */}
                    {expandido && (
                      <TableRow className={`nav:hidden transition-all duration-200 ease-in-out ${expandido ? "bg-accent/30 dark:bg-zinc-800/50 border-l-4 border-l-primary" : ""}`}>
                        <TableCell colSpan={4} className="bg-muted/30 p-3 max-w-full overflow-hidden">
                          <div className="flex flex-row items-start justify-between gap-3 w-full max-w-full overflow-hidden">
                            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-2 text-xs break-words whitespace-normal">
                              <div className="col-span-2 min-w-0 break-words whitespace-normal">
                                <span className="text-muted-foreground font-medium">Email: </span>
                                <span className="break-all font-mono text-[11px]">{u.email}</span>
                              </div>
                              <div className="min-w-0 break-words">
                                <span className="text-muted-foreground font-medium">Tienda: </span>
                                {nombreTienda(u.store_id)}
                              </div>
                              <div className="min-w-0 break-words">
                                <span className="text-muted-foreground font-medium">Teléfono: </span>
                                {u.telefono || "Sin registrar"}
                              </div>
                              <div className="min-w-0 break-words">
                                <span className="text-muted-foreground font-medium">Estado: </span>
                                <Badge variant={u.activo ? "success" : "destructive"}>
                                  {u.activo ? "Activo" : "Inactivo"}
                                </Badge>
                              </div>
                              {u.fecha_creacion && (
                                <div className="col-span-2 min-w-0 break-words">
                                  <span className="text-muted-foreground font-medium">Fecha de alta: </span>
                                  {new Date(u.fecha_creacion).toLocaleDateString("es-AR")}
                                </div>
                              )}
                            </div>

                            <div className="relative shrink-0 rounded-full overflow-hidden border bg-background shadow-sm h-14 w-14 flex items-center justify-center text-base font-bold bg-[var(--navy-800)] text-white">
                              {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar_url} alt={u.nombre} className="h-full w-full object-cover" />
                              ) : (
                                u.nombre.trim().charAt(0).toUpperCase() || "?"
                              )}
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
            <div>
              <Label>Tienda asignada</Label>
              <Select
                value={form.store_id ?? SIN_TIENDA}
                onValueChange={(v) => setForm({ ...form, store_id: v === SIN_TIENDA ? null : v })}
                disabled={!puedeAsignarTienda(form.role_id)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_TIENDA}>Todas las tiendas</SelectItem>
                  {tiendas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.role_id === "admin" && !yoSoySuperAdmin
                  ? "Solo el super admin puede asignarle una tienda a un administrador."
                  : "Si le asignás una tienda, esta cuenta solo va a ver el inventario y los movimientos de ese lugar."}
              </p>
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
              <Label>Tienda asignada</Label>
              <Select
                value={formCrear.store_id ?? SIN_TIENDA}
                onValueChange={(v) => setFormCrear({ ...formCrear, store_id: v === SIN_TIENDA ? null : v })}
                disabled={!puedeAsignarTienda(formCrear.role_id)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_TIENDA}>Todas las tiendas</SelectItem>
                  {tiendas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {formCrear.role_id === "admin" && !yoSoySuperAdmin
                  ? "Solo el super admin puede crear un administrador limitado a una tienda."
                  : "Si le asignás una tienda, esta cuenta solo va a ver el inventario y los movimientos de ese lugar."}
              </p>
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

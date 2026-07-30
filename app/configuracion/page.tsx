"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { getDB, saveDB, idGen, clearAllData, formatDate, type DB } from "@/lib/db";
import { setRolActivo, useRolActivo, type RolUsuario } from "@/lib/role";
import { setSesionDisplay, useSesionDisplay } from "@/lib/session";
import { marcarBackupHecho } from "@/lib/backup";
import { obtenerCotizacionOficial, type CotizacionDolar } from "@/lib/dolar";

export default function ConfiguracionPage() {
  const [data, setData] = useState<DB | null>(null);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [cotizacionInfo, setCotizacionInfo] = useState<CotizacionDolar | null>(null);
  const [cotizacionError, setCotizacionError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { rol, esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();
  const [nombreSesion, setNombreSesion] = useState("");

  useEffect(() => {
    const db = getDB();
    setData(db);
    setNombreNegocio(db.config.nombre || "");
  }, []);

  // Cotización automática: se trae sola al entrar a esta pantalla y se
  // guarda directo (sin que haga falta tocar nada ni tocar "Guardar").
  useEffect(() => {
    obtenerCotizacionOficial()
      .then((info) => {
        setCotizacionInfo(info);
        setCotizacionError(false);
        const db = getDB();
        db.config = { ...db.config, cotizacion_usd: info.venta };
        saveDB(db);
        setData(db);
      })
      .catch(() => setCotizacionError(true));
  }, []);

  useEffect(() => {
    setNombreSesion(sesion.nombre);
  }, [sesion]);

  if (!data) return null;

  function guardarConfig() {
    const db = getDB();
    db.config = { ...db.config, nombre: nombreNegocio.trim() };
    saveDB(db);
    setData(db);
    toast.success("Configuración guardada");
  }

  function agregarCategoria() {
    if (!nuevaCategoria.trim()) return;
    const db = getDB();
    db.categorias.push({ id: idGen(), nombre: nuevaCategoria.trim() });
    saveDB(db);
    setData(db);
    setNuevaCategoria("");
  }

  function quitarCategoria(id: string) {
    const db = getDB();
    const enUso = db.activos.filter((a) => a.categoria_id === id && a.estado !== "Baja").length;
    if (enUso > 0) {
      const confirmado = confirm(
        `Hay ${enUso} ítem(s) de inventario con esta categoría. Si la borrás van a quedar sin categoría asignada. ¿Continuar?`
      );
      if (!confirmado) return;
    }
    db.categorias = db.categorias.filter((c) => c.id !== id);
    db.activos = db.activos.map((a) => (a.categoria_id === id ? { ...a, categoria_id: null } : a));
    saveDB(db);
    setData(db);
  }

  function exportarDatos() {
    const db = getDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-ly25-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    marcarBackupHecho();
    toast.success("Datos exportados");
  }

  function importarDatos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<DB>;
        if (!parsed.tiendas || !parsed.activos) {
          toast.error("Formato inválido");
          return;
        }
        saveDB(parsed as DB);
        setData(getDB());
        toast.success("Datos importados correctamente");
      } catch (err) {
        toast.error("Error al importar: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function guardarSesion() {
    setSesionDisplay({ nombre: nombreSesion.trim() || "Invitado", usuarioId: undefined });
    toast.success("Sesión actualizada");
  }

  function elegirUsuario(usuarioId: string) {
    const usuario = data?.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return;
    setSesionDisplay({ nombre: usuario.nombre, usuarioId: usuario.id });
    setRolActivo(usuario.rol);
    toast.success(`Ahora navegás como ${usuario.nombre}`);
  }

  function limpiarTodo() {
    if (!confirm("¿Estás seguro? Se borrarán TODOS los datos guardados en este navegador.")) return;
    clearAllData();
    setData(getDB());
    toast.success("Todos los datos fueron eliminados");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Configuración</h3>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión (prototipo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Todavía no hay autenticación real conectada (eso llega con Supabase Auth + Row Level Security). Mientras
            tanto, elegí qué usuario de la lista está navegando: de ahí sale el nombre que se ve en el encabezado y
            el rol (Administrador/Usuario) que define los permisos.
          </p>

          {data.usuarios.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Select value={sesion.usuarioId || ""} onValueChange={elegirUsuario}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Elegir usuario" /></SelectTrigger>
                <SelectContent>
                  {data.usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre} · {u.rol === "admin" ? "Administrador" : "Usuario"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant={rol === "admin" ? "info" : "secondary"}>
                Actual: {sesion.nombre} ({rol === "admin" ? "Administrador" : "Usuario"})
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no cargaste usuarios. Andá a la sección <strong>Usuarios</strong> y creá el primero (elegí rol
              Administrador) para poder seleccionarlo acá.
            </p>
          )}

          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
              Ajuste manual (por si todavía no hay usuarios cargados)
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <Label>Rol</Label>
                <Select value={rol} onValueChange={(v) => setRolActivo(v as RolUsuario)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="usuario">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre (encabezado)</Label>
                <Input value={nombreSesion} onChange={(e) => setNombreSesion(e.target.value)} className="max-w-sm" />
              </div>
              <Button variant="outline" onClick={guardarSesion}>Guardar</Button>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre del negocio</Label>
            <Input value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} />
          </div>
          <div>
            <Label>Cotización USD (ARS por 1 USD) · automática</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-lg font-semibold text-foreground">
                {data.config.cotizacion_usd ? `$${data.config.cotizacion_usd}` : "—"}
              </span>
              {cotizacionInfo && (
                <Badge variant="success">Actualizado {formatDate(cotizacionInfo.fechaActualizacion)}</Badge>
              )}
              {cotizacionError && <Badge variant="destructive">No se pudo actualizar ahora</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Se trae sola (dólar oficial, valor de venta) cada vez que entrás a esta pantalla, desde{" "}
              <a href="https://dolarapi.com" target="_blank" rel="noreferrer" className="underline">
                DolarApi.com
              </a>{" "}
              (API comunitaria, no es un dato oficial del BCRA). Es solo de referencia: cada ítem del
              inventario sigue guardando su propio precio en ARS y en USD por separado.
            </p>
          </div>
          <Button onClick={guardarConfig}>Guardar Configuración</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorías</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {data.categorias.map((c) => (
              <Badge key={c.id} variant="secondary" className="gap-1">
                {c.nombre}
                {esAdmin && (
                  <button onClick={() => quitarCategoria(c.id)}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {esAdmin && (
            <div className="flex gap-2">
              <Input
                placeholder="Nueva categoría"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarCategoria())}
              />
              <Button variant="outline" onClick={agregarCategoria}>Agregar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {esAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos (prototipo local)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportarDatos}>Exportar Datos (JSON)</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importar Datos</Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importarDatos} />
            <Button variant="destructive" onClick={limpiarTodo}>Limpiar Todos los Datos</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

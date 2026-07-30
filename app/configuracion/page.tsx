"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, RefreshCw } from "lucide-react";
import { getDB, saveDB, idGen, clearAllData, type DB } from "@/lib/db";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { cerrarSesion as cerrarSesionAuth } from "@/lib/auth";
import { marcarBackupHecho } from "@/lib/backup";
import { obtenerCotizacionOficial } from "@/lib/dolar";
import { cn } from "@/lib/utils";

export default function ConfiguracionPage() {
  const [data, setData] = useState<DB | null>(null);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [cotizacion, setCotizacion] = useState("");
  const [actualizandoCotizacion, setActualizandoCotizacion] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { rol, esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  useEffect(() => {
    const db = getDB();
    setData(db);
    setNombreNegocio(db.config.nombre || "");
    setCotizacion(db.config.cotizacion_usd ? String(db.config.cotizacion_usd) : "");
  }, []);

  if (!data) return null;

  function guardarConfig() {
    const db = getDB();
    db.config = {
      ...db.config,
      nombre: nombreNegocio.trim(),
      cotizacion_usd: cotizacion.trim() ? Number(cotizacion) : undefined,
    };
    saveDB(db);
    setData(db);
    toast.success("Configuración guardada");
  }

  async function actualizarCotizacion() {
    setActualizandoCotizacion(true);
    try {
      const info = await obtenerCotizacionOficial();
      setCotizacion(String(info.venta));
      toast.success('Cotización oficial traída. Tocá "Guardar Configuración" para dejarla guardada.');
    } catch {
      toast.error("No se pudo traer la cotización");
    } finally {
      setActualizandoCotizacion(false);
    }
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

  function cerrarSesion() {
    cerrarSesionAuth();
    toast.info("Sesión cerrada");
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
          <CardTitle className="text-base">Sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para entrar ahora hace falta email y contraseña (login local del prototipo, en{" "}
            <strong>Usuarios</strong> podés asignarle contraseña a cada uno). Cuando conectemos Supabase Auth esto se
            reemplaza por un login real con permisos verificados en el servidor.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={rol === "admin" ? "info" : "secondary"}>
              Sesión actual: {sesion.nombre} ({rol === "admin" ? "Administrador" : "Usuario"})
            </Badge>
            <Button variant="outline" onClick={cerrarSesion}>Cerrar sesión</Button>
          </div>
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
            <Label>Cotización USD (ARS por 1 USD)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                value={cotizacion}
                onChange={(e) => setCotizacion(e.target.value)}
                className="max-w-[160px]"
              />
              <Button variant="outline" onClick={actualizarCotizacion} disabled={actualizandoCotizacion}>
                <RefreshCw className={cn("h-4 w-4", actualizandoCotizacion && "animate-spin")} />
                Cotizar actual (dólar oficial)
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              La podés escribir a mano, o traerla con el botón desde{" "}
              <a href="https://dolarapi.com" target="_blank" rel="noreferrer" className="underline">
                DolarApi.com
              </a>{" "}
              (dólar oficial, valor de venta — API comunitaria, no es un dato oficial del BCRA). En cualquier caso,
              no queda guardada hasta que toques &quot;Guardar Configuración&quot;.
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

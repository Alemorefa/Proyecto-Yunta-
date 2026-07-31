"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, RefreshCw } from "lucide-react";
import { getDB, saveDB, clearAllData, type DB } from "@/lib/db";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { cerrarSesion as cerrarSesionAuth } from "@/lib/auth";
import { marcarBackupHecho } from "@/lib/backup";
import { obtenerCotizacionOficial } from "@/lib/dolar";
import { migrarDatosLocalesASupabase, type ResultadoMigracion } from "@/lib/migracion";
import {
  listarCategorias,
  crearCategoria,
  borrarCategoria,
  contarActivosPorCategoria,
  type Categoria,
} from "@/lib/catalogos";
import { cn } from "@/lib/utils";

export default function ConfiguracionPage() {
  const [data, setData] = useState<DB | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [cotizacion, setCotizacion] = useState("");
  const [actualizandoCotizacion, setActualizandoCotizacion] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracion, setResultadoMigracion] = useState<ResultadoMigracion | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { rol, esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargarCategorias() {
    setCategorias(await listarCategorias());
  }

  useEffect(() => {
    const db = getDB();
    setData(db);
    setNombreNegocio(db.config.nombre || "");
    setCotizacion(db.config.cotizacion_usd ? String(db.config.cotizacion_usd) : "");
    cargarCategorias().catch((err) => toast.error("No se pudieron cargar las categorías: " + (err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function agregarCategoria() {
    if (!nuevaCategoria.trim()) return;
    try {
      await crearCategoria(nuevaCategoria.trim());
      setNuevaCategoria("");
      await cargarCategorias();
    } catch (err) {
      toast.error("No se pudo crear la categoría: " + (err as Error).message);
    }
  }

  async function quitarCategoria(id: string) {
    const enUso = await contarActivosPorCategoria(id);
    if (enUso > 0) {
      const confirmado = confirm(
        `Hay ${enUso} ítem(s) de inventario con esta categoría. Si la borrás van a quedar sin categoría asignada. ¿Continuar?`
      );
      if (!confirmado) return;
    }
    try {
      await borrarCategoria(id);
      await cargarCategorias();
    } catch (err) {
      toast.error("No se pudo borrar la categoría: " + (err as Error).message);
    }
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

  async function cerrarSesion() {
    await cerrarSesionAuth();
    toast.info("Sesión cerrada");
  }

  function limpiarTodo() {
    if (!confirm("¿Estás seguro? Se borrarán TODOS los datos guardados en este navegador.")) return;
    clearAllData();
    setData(getDB());
    toast.success("Todos los datos fueron eliminados");
  }

  async function migrarASupabase() {
    if (
      !confirm(
        "Esto copia tiendas, inventario, movimientos e impresoras de este navegador a Supabase. No borra nada local. ¿Continuar?"
      )
    )
      return;
    setMigrando(true);
    setResultadoMigracion(null);
    const resultado = await migrarDatosLocalesASupabase();
    setMigrando(false);
    setResultadoMigracion(resultado);
    if (resultado.ok) {
      toast.success("Migración completada");
    } else {
      toast.error("La migración se cortó: " + resultado.error);
    }
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
            El login ahora es real (Supabase Auth): tu contraseña queda hasheada del lado del servidor, nadie
            (ni nosotros) puede verla. El primer administrador se crea solo al registrarse por primera vez; para
            ascender a alguien más a Administrador, por ahora hay que hacerlo a mano desde el panel de Supabase
            (tabla <code>users</code>, columna <code>role_id</code>) hasta que terminemos de migrar también la
            pantalla de Usuarios.
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
            {categorias.map((c) => (
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

      {esAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Migración a Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copia todo lo que hoy está guardado en este navegador (tiendas, sectores, categorías, inventario,
              movimientos, impresoras y la configuración general) a las tablas de Supabase. No borra nada local, así
              que se puede reintentar sin miedo si algo falla a la mitad. Los usuarios de la pantalla{" "}
              <strong>Usuarios</strong> no se migran — cada persona tiene que crear su cuenta real desde el login.
            </p>
            <Button onClick={migrarASupabase} disabled={migrando}>
              <RefreshCw className={cn("h-4 w-4", migrando && "animate-spin")} />
              {migrando ? "Migrando..." : "Migrar datos locales a Supabase"}
            </Button>
            {resultadoMigracion && (
              <div className="rounded-md border px-3 py-2 text-sm">
                {resultadoMigracion.ok ? (
                  <p className="text-green-600 dark:text-green-400">
                    Listo: se copiaron {resultadoMigracion.resumen.join(", ")}.
                  </p>
                ) : (
                  <>
                    <p className="text-destructive">Se cortó en: {resultadoMigracion.error}</p>
                    {resultadoMigracion.resumen.length > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Alcanzó a copiar antes: {resultadoMigracion.resumen.join(", ")}.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

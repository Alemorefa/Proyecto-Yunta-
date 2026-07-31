"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, X } from "lucide-react";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { cerrarSesion as cerrarSesionAuth } from "@/lib/auth";
import { marcarBackupHecho } from "@/lib/backup";
import { obtenerCotizacionOficial } from "@/lib/dolar";
import { obtenerConfig, guardarConfig as guardarConfigSupabase, registrarCotizacion } from "@/lib/config-data";
import { generarBackupCompleto } from "@/lib/backup-data";
import {
  listarCategorias,
  crearCategoria,
  borrarCategoria,
  contarActivosPorCategoria,
  type Categoria,
} from "@/lib/catalogos";
import { cn } from "@/lib/utils";

export default function ConfiguracionPage() {
  const [cargado, setCargado] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [cotizacion, setCotizacion] = useState("");
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [actualizandoCotizacion, setActualizandoCotizacion] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [exportando, setExportando] = useState(false);
  const { rol, esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargarCategorias() {
    setCategorias(await listarCategorias());
  }

  useEffect(() => {
    obtenerConfig()
      .then((c) => {
        setNombreNegocio(c.nombre_negocio || "");
        setCotizacion(c.cotizacion_usd ? String(c.cotizacion_usd) : "");
        setCargado(true);
      })
      .catch((err) => toast.error("No se pudo cargar la configuración: " + (err as Error).message));
    cargarCategorias().catch((err) => toast.error("No se pudieron cargar las categorías: " + (err as Error).message));
  }, []);

  if (!cargado) return null;

  async function guardarConfig() {
    setGuardandoConfig(true);
    try {
      await guardarConfigSupabase({
        nombre_negocio: nombreNegocio,
        cotizacion_usd: cotizacion.trim() ? Number(cotizacion) : null,
      });
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error("No se pudo guardar: " + (err as Error).message);
    } finally {
      setGuardandoConfig(false);
    }
  }

  async function actualizarCotizacion() {
    setActualizandoCotizacion(true);
    try {
      const info = await obtenerCotizacionOficial();
      setCotizacion(String(info.venta));
      registrarCotizacion(info).catch(() => {});
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

  async function exportarDatos() {
    setExportando(true);
    try {
      const backup = await generarBackupCompleto();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `inventario-ly25-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      marcarBackupHecho();
      toast.success("Backup exportado");
    } catch (err) {
      toast.error("No se pudo generar el backup: " + (err as Error).message);
    } finally {
      setExportando(false);
    }
  }

  async function cerrarSesion() {
    await cerrarSesionAuth();
    toast.info("Sesión cerrada");
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
            El login es real (Supabase Auth): tu contraseña queda hasheada del lado del servidor, nadie (ni
            nosotros) puede verla. El primer administrador se crea solo al registrarse por primera vez; para
            ascender a alguien más a Administrador, andá a la pantalla <strong>Usuarios</strong> y cambiale el rol.
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
          <Button onClick={guardarConfig} disabled={guardandoConfig}>
            {guardandoConfig ? "Guardando..." : "Guardar Configuración"}
          </Button>
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
            <CardTitle className="text-base">Backup de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Todos los datos viven en Supabase (no en este navegador), así que no hace falta &quot;importar&quot; ni
              &quot;limpiar&quot; nada desde acá. Este botón descarga una foto completa (JSON) de tiendas, inventario,
              movimientos, impresoras, usuarios y configuración, útil como respaldo o para revisar algo puntual.
            </p>
            <Button variant="outline" onClick={exportarDatos} disabled={exportando}>
              <RefreshCw className={cn("h-4 w-4", exportando && "animate-spin")} />
              {exportando ? "Generando..." : "Exportar Backup (JSON)"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

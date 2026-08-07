"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowDownCircle,
  Store,
  Package,
  Users,
  FolderCog,
  CheckCircle2,
  Circle,
  Inbox,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import { formatDate, type AccionMovimiento } from "@/lib/db";
import { listarTiendas, listarCategorias, type Tienda, type Categoria } from "@/lib/catalogos";
import { listarActivos, type Activo } from "@/lib/inventario-data";
import { listarMovimientos, listarUsuariosBasico, type Movimiento, type UsuarioBasico } from "@/lib/movimientos-data";
import { getUltimoBackup } from "@/lib/backup";

function iconoAccion(accion: AccionMovimiento) {
  switch (accion) {
    case "Alta":
      return Plus;
    case "Transferencia":
      return ArrowRightLeft;
    case "Baja":
      return ArrowDownCircle;
    default:
      return Pencil;
  }
}

export default function InicioPage() {
  const router = useRouter();
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [activos, setActivos] = useState<Activo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [cargado, setCargado] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarTiendas(), listarActivos(), listarCategorias(), listarMovimientos(), listarUsuariosBasico()])
      .then(([t, a, c, m, u]) => {
        setTiendas(t);
        setActivos(a);
        setCategorias(c);
        setMovimientos(m);
        setUsuarios(u);
        setCargado(true);
      })
      .catch((err) => toast.error("No se pudo cargar el inicio: " + (err as Error).message));
    setUltimoBackup(getUltimoBackup());
  }, []);

  function irA(href: string, mensaje?: string) {
    if (mensaje) toast.info(mensaje);
    router.push(href);
  }

  const resumen = useMemo(
    () => [
      {
        label: "Tiendas",
        value: tiendas.length,
        icon: Store,
        href: "/tiendas",
        cta: "Gestionar tiendas",
      },
      {
        label: "Activos",
        value: activos.length,
        icon: Package,
        href: "/inventario",
        cta: "Ver inventario",
      },
      {
        label: "Categorías",
        value: categorias.length,
        icon: FolderCog,
        href: "/configuracion",
        cta: "Editar categorías",
      },
      {
        label: "Usuarios",
        value: usuarios.length,
        icon: Users,
        href: "/usuarios",
        cta: "Ver usuarios",
      },
    ],
    [tiendas, activos, categorias, usuarios]
  );

  const ultimosMovimientos = useMemo(() => {
    return [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
  }, [movimientos]);

  const nombreUsuario = (id: string | null) => (id ? usuarios.find((u) => u.id === id)?.nombre || "-" : "-");

  const pasos = useMemo(
    () => [
      {
        label: "Creá tu primera tienda",
        done: tiendas.length > 0,
        href: "/tiendas",
        cta: "Ir a Tiendas",
      },
      {
        label: "Cargá tu primer activo",
        done: activos.length > 0,
        href: "/inventario?abrir=nuevo",
        cta: "Agregar ítem",
      },
      {
        label: "Agregá a tu equipo",
        done: usuarios.length > 1,
        href: "/usuarios",
        cta: "Ir a Usuarios",
      },
      {
        label: "Hacé tu primer backup",
        done: !!ultimoBackup,
        href: "/configuracion",
        cta: "Ir a Configuración",
      },
    ],
    [tiendas, activos, usuarios, ultimoBackup]
  );
  const pasosPendientes = pasos.filter((p) => !p.done);

  if (!cargado) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-[var(--navy-800)] to-[var(--navy-900)] p-8 text-white shadow-sm">
        <h2 className="mb-2 text-2xl font-semibold">Sistema de Inventario · La Yunta</h2>
        <p className="opacity-80">
          Administrá los activos físicos de todas las sucursales: altas, transferencias, bajas e historial.
        </p>
      </div>

      {/* KPIs con CTA contextual */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {resumen.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.label} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.label}
                  <Icon className="h-4 w-4" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-3xl font-bold text-foreground">{r.value}</p>
                <Link
                  href={r.href}
                  className="text-xs font-medium text-[hsl(var(--link))] hover:underline"
                >
                  {r.cta} →
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Actividad reciente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {ultimosMovimientos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">
                  Todavía no hay actividad. Cuando registres un alta, transferencia o baja, va a aparecer acá.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {ultimosMovimientos.map((m) => {
                  const Icon = iconoAccion(m.accion);
                  const activo = activos.find((a) => a.id === m.asset_id);
                  return (
                    <li key={m.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {m.accion} · {activo?.nombre ?? "Activo eliminado"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.observacion || "Sin observación"} · {nombreUsuario(m.usuario_id)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.fecha)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Primeros pasos: se oculta solo cuando ya están todos completos */}
        {pasosPendientes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primeros pasos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pasos.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {p.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={p.done ? "text-muted-foreground line-through" : "text-foreground"}>
                        {p.label}
                      </span>
                    </span>
                    {!p.done && (
                      <Button size="sm" variant="outline" onClick={() => irA(p.href)}>
                        {p.cta}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

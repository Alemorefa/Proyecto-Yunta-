"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowLeftRight,
  ArrowDownCircle,
  History,
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
import {
  getDB,
  seedInitialData,
  formatDate,
  type DB,
  type AccionMovimiento,
} from "@/lib/db";
import { useRolActivo } from "@/lib/role";
import { getUltimoBackup } from "@/lib/backup";

// Accesos rápidos: cada uno navega a la pantalla correspondiente ya lista
// para actuar (diálogo de alta abierto, tipo de movimiento preseleccionado).
// Los mismos destinos se disparan con el mouse o con el atajo de teclado.
const ACCESOS_RAPIDOS = [
  { tecla: "N", label: "Nuevo ítem", href: "/inventario?abrir=nuevo", icon: Plus, soloAdmin: true },
  { tecla: "T", label: "Transferencia", href: "/movimientos?accion=transferencia", icon: ArrowLeftRight, soloAdmin: true },
  { tecla: "B", label: "Baja", href: "/movimientos?accion=baja", icon: ArrowDownCircle, soloAdmin: true },
  { tecla: "H", label: "Historial", href: "/historial", icon: History, soloAdmin: false },
] as const;

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
  const [data, setData] = useState<DB | null>(null);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);
  const { esAdmin } = useRolActivo();

  useEffect(() => {
    seedInitialData();
    setData(getDB());
    setUltimoBackup(getUltimoBackup());
  }, []);

  function irA(href: string, mensaje?: string) {
    if (mensaje) toast.info(mensaje);
    router.push(href);
  }

  // Atajos de teclado N/T/B/H: se ignoran mientras el usuario está
  // escribiendo en un campo, o si hay una tecla modificadora presionada.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const escribiendo =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (escribiendo || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      const accion = ACCESOS_RAPIDOS.find((a) => a.tecla.toLowerCase() === key);
      if (!accion) return;
      if (accion.soloAdmin && !esAdmin) return;
      e.preventDefault();
      irA(accion.href, `Acceso rápido: ${accion.label} (${accion.tecla})`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin]);

  const resumen = useMemo(
    () => [
      {
        label: "Tiendas",
        value: data?.tiendas.length ?? 0,
        icon: Store,
        href: "/tiendas",
        cta: "Gestionar tiendas",
      },
      {
        label: "Activos",
        value: data?.activos.length ?? 0,
        icon: Package,
        href: "/inventario",
        cta: "Ver inventario",
      },
      {
        label: "Categorías",
        value: data?.categorias.length ?? 0,
        icon: FolderCog,
        href: "/configuracion",
        cta: "Editar categorías",
      },
      {
        label: "Usuarios",
        value: data?.usuarios.length ?? 0,
        icon: Users,
        href: "/usuarios",
        cta: "Ver usuarios",
      },
    ],
    [data]
  );

  const ultimosMovimientos = useMemo(() => {
    if (!data) return [];
    return [...data.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
  }, [data]);

  const pasos = useMemo(
    () => [
      {
        label: "Creá tu primera tienda",
        done: (data?.tiendas.length ?? 0) > 0,
        href: "/tiendas",
        cta: "Ir a Tiendas",
      },
      {
        label: "Cargá tu primer activo",
        done: (data?.activos.length ?? 0) > 0,
        href: "/inventario?abrir=nuevo",
        cta: "Agregar ítem",
      },
      {
        label: "Agregá a tu equipo",
        done: (data?.usuarios.length ?? 0) > 0,
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
    [data, ultimoBackup]
  );
  const pasosPendientes = pasos.filter((p) => !p.done);

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-[var(--navy-800)] to-[var(--navy-900)] p-8 text-white shadow-sm">
        <h2 className="mb-2 text-2xl font-semibold">Sistema de Inventario · La Yunta</h2>
        <p className="opacity-80">
          Administrá los activos físicos de todas las sucursales: altas, transferencias, bajas e historial.
        </p>
      </div>

      {/* Accesos rápidos: solo en mobile (por debajo del breakpoint del drawer) */}
      <div className="nav:hidden">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accesos rápidos
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACCESOS_RAPIDOS.filter((a) => !a.soloAdmin || esAdmin).map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.href}
                onClick={() => irA(a.href)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{a.label}</span>
                  <span className="text-xs text-muted-foreground">Atajo: {a.tecla}</span>
                </span>
                <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground sm:block">
                  {a.tecla}
                </kbd>
              </button>
            );
          })}
        </div>
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
                  className="text-xs font-medium text-primary hover:underline"
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
                  const activo = data.activos.find((a) => a.id === m.activo_id);
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
                          {m.observacion || "Sin observación"} · {m.usuario}
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Store,
  Package,
  Printer,
  ArrowLeftRight,
  History,
  Users,
  Settings,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tiendas", label: "Tiendas", icon: Store },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/impresoras", label: "Impresoras", icon: Printer },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/usuarios", label: "Usuarios", icon: Users },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  /** Si el drawer está abierto (solo aplica por debajo del breakpoint `nav`). */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay: solo visible en pantallas angostas cuando el drawer está abierto */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 nav:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-60 flex-col bg-[var(--navy-800)] text-white transition-transform duration-300 nav:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4 md:p-6">
          <h1 className="text-lg font-bold text-primary">Inventarios</h1>
          <button
            className="rounded p-1 text-white/70 hover:bg-white/10 nav:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white md:px-6",
                  active && "border-primary bg-primary/15 text-primary"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/40">
          v0.1.0-prototipo
        </div>
      </aside>
    </>
  );
}

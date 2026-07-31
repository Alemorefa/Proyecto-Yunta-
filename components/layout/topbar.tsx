"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Menu, Search, User, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useSesionDisplay } from "@/lib/session";
import { useTema } from "@/lib/theme";
import { cerrarSesion as cerrarSesionAuth } from "@/lib/auth";
import { buscarGlobal, type ResultadoBusqueda } from "@/lib/busqueda-global";

const TITLES: Record<string, string> = {
  "/": "Inicio",
  "/dashboard": "Dashboard",
  "/tiendas": "Tiendas",
  "/inventario": "Inventario",
  "/impresoras": "Impresoras",
  "/movimientos": "Movimientos",
  "/historial": "Historial",
  "/usuarios": "Usuarios",
  "/configuracion": "Configuración",
};

export function Topbar({
  pathname,
  onAbrirMenu,
}: {
  pathname: string;
  onAbrirMenu: () => void;
}) {
  const router = useRouter();
  const sesion = useSesionDisplay();
  const { tema, alternar } = useTema();

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const buscadorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const busquedaIdRef = useRef(0);

  // Cierra buscador/menú de usuario al hacer click afuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target as Node)) {
        setBuscadorAbierto(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onBuscar(valor: string) {
    setBusqueda(valor);
    setBuscadorAbierto(true);
    const idBusqueda = ++busquedaIdRef.current;
    buscarGlobal(valor).then((r) => {
      if (idBusqueda === busquedaIdRef.current) setResultados(r);
    });
  }

  function irAResultado(r: ResultadoBusqueda) {
    setBuscadorAbierto(false);
    setBusqueda("");
    router.push(r.href);
  }

  async function cerrarSesion() {
    setMenuAbierto(false);
    await cerrarSesionAuth();
    toast.info("Sesión cerrada");
  }

  const inicial = sesion.nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button
          className="rounded-full p-2 text-muted-foreground hover:bg-muted nav:hidden"
          aria-label="Abrir menú"
          onClick={onAbrirMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{TITLES[pathname] ?? ""}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Buscador global */}
        <div ref={buscadorRef} className="relative">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              onFocus={() => setBuscadorAbierto(true)}
              placeholder="Buscar..."
              className="w-24 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:w-40 md:w-56"
            />
          </div>

          {buscadorAbierto && busqueda.trim() && (
            <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-lg border bg-card shadow-lg">
              {resultados.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Sin resultados para &quot;{busqueda}&quot;</p>
              ) : (
                resultados.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => irAResultado(r)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate text-foreground">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.sub ?? r.tipo}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Indicador de conexión: los datos viven en Supabase, no en este navegador */}
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Conectado
        </span>

        {/* Botón directo para alternar modo oscuro/claro */}
        <button
          onClick={alternar}
          className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
          aria-label="Alternar modo oscuro"
          title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {tema === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* Avatar + menú de usuario */}
        <div ref={menuRef} className="relative border-l pl-2 sm:pl-4">
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy-800)] text-sm font-semibold text-white">
              {inicial}
            </div>
            <p className="hidden text-sm font-semibold text-foreground sm:block">{sesion.nombre}</p>
          </button>

          {menuAbierto && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border bg-card p-1 shadow-lg">
              <button
                onClick={() => {
                  setMenuAbierto(false);
                  router.push("/configuracion");
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <User className="h-4 w-4" /> Perfil
              </button>

              <button
                onClick={() => {
                  setMenuAbierto(false);
                  toast.info("Más preferencias próximamente. El modo oscuro ya está disponible en el botón del sol/luna.");
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="h-4 w-4" /> Preferencias
              </button>

              <div className="my-1 border-t" />

              <button
                onClick={cerrarSesion}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

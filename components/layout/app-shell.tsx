"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { LoginScreen } from "./login-screen";
import { useAutenticado } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useAutenticado();

  // Cierra el drawer automáticamente al navegar a otra página.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // null: todavía no se leyó localStorage (evita el flash de login en el
  // primer render). false: no logueado, se muestra la pantalla de login.
  if (auth === null) return null;
  if (auth === false) return <LoginScreen />;

  return (
    <div className="flex min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col nav:ml-60">
        <Topbar pathname={pathname} onAbrirMenu={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

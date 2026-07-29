"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BackupBanner } from "./backup-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cierra el drawer automáticamente al navegar a otra página.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex flex-1 flex-col nav:ml-60">
        <Topbar pathname={pathname} onAbrirMenu={() => setDrawerOpen(true)} />
        <BackupBanner />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

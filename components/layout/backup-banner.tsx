"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { backupDesactualizado } from "@/lib/backup";

export function BackupBanner() {
  const [mostrar, setMostrar] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    setMostrar(backupDesactualizado());
  }, []);

  if (!mostrar || oculto) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200 md:px-8">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Todos los datos viven en este navegador. Hace tiempo que no exportás un backup —{" "}
          <Link href="/configuracion" className="font-medium underline underline-offset-2">
            exportalo ahora
          </Link>{" "}
          para no perder información.
        </span>
      </div>
      <button aria-label="Cerrar aviso" onClick={() => setOculto(true)} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ATAJOS } from "@/lib/atajos";
import { useRolActivo } from "@/lib/role";
import { toast } from "sonner";
import { Keyboard } from "lucide-react";

export function AtajosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { esAdmin } = useRolActivo();

  function ejecutarAtajo(href: string, label: string, soloAdmin: boolean) {
    if (soloAdmin && !esAdmin) {
      toast.error("Esta acción requiere rol de Administrador");
      return;
    }
    onOpenChange(false);
    toast.info(`Navegando a ${label}`);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] w-full sm:max-w-md p-3.5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
            <Keyboard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Atajos del Sistema
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Accedé rápidamente a las secciones principales del sistema.
          </p>
        </DialogHeader>

        {/* Grid de 4 cuadritos compacto para mobile y desktop */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 py-1">
          {ATAJOS.map((atajo) => {
            const Icon = atajo.icon;
            const restringido = atajo.soloAdmin && !esAdmin;

            return (
              <button
                key={atajo.tecla}
                type="button"
                onClick={() => ejecutarAtajo(atajo.href, atajo.label, atajo.soloAdmin)}
                className={`relative flex flex-col justify-between rounded-lg border-2 p-2.5 sm:p-3 text-left transition-colors duration-150 ${
                  restringido
                    ? "cursor-not-allowed opacity-50 bg-muted/30 border-muted"
                    : "bg-card border-border hover:border-foreground/40 hover:bg-muted/40 shadow-xs"
                }`}
              >
                {/* Fila superior: Ícono (Tecla visible solo en desktop sm+) */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md border bg-muted text-foreground">
                    <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-foreground" />
                  </div>

                  {/* Tecla en badge (Oculto en mobile, visible solo en pantallas sm+) */}
                  <kbd className="hidden sm:inline-flex h-7 min-w-[30px] items-center justify-center rounded-md border-2 border-primary bg-primary text-primary-foreground px-2 font-mono text-xs font-black shadow-xs">
                    {atajo.tecla}
                  </kbd>
                </div>

                {/* Título y descripción */}
                <div className="mt-2 sm:mt-3">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                      {atajo.label}
                    </span>
                    {atajo.soloAdmin && (
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] font-semibold py-0 px-1 border-amber-500/60 text-amber-600 dark:text-amber-400 shrink-0">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-tight">
                    {atajo.descripcion}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px] font-bold text-foreground">SHIFT</kbd>
            <span>Mantené presionado <strong className="text-foreground">Shift</strong> para ver este cuadro.</span>
          </div>
          <Button variant="secondary" size="sm" className="w-full sm:w-auto text-xs h-8" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

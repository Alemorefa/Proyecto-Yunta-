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
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Keyboard className="h-5 w-5 text-primary" />
            Atajos del Sistema
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Accedé rápidamente haciendo clic en cualquier recuadro o presionando la tecla indicada.
          </p>
        </DialogHeader>

        {/* Grid de 4 cuadritos con alto contraste y hover sutil */}
        <div className="grid grid-cols-2 gap-3.5 py-3">
          {ATAJOS.map((atajo) => {
            const Icon = atajo.icon;
            const restringido = atajo.soloAdmin && !esAdmin;

            return (
              <button
                key={atajo.tecla}
                type="button"
                onClick={() => ejecutarAtajo(atajo.href, atajo.label, atajo.soloAdmin)}
                className={`relative flex flex-col justify-between rounded-xl border-2 p-4 text-left transition-colors duration-150 ${
                  restringido
                    ? "cursor-not-allowed opacity-50 bg-muted/30 border-muted"
                    : "bg-card border-border hover:border-foreground/40 hover:bg-muted/40 shadow-xs"
                }`}
              >
                {/* Fila superior: Ícono y Tecla con alto contraste */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-foreground">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>

                  {/* Tecla badge súper clara y legible */}
                  <kbd className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border-2 border-primary bg-primary text-primary-foreground px-3 font-mono text-base font-black shadow-xs">
                    {atajo.tecla}
                  </kbd>
                </div>

                {/* Título y descripción */}
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-base text-foreground">
                      {atajo.label}
                    </span>
                    {atajo.soloAdmin && (
                      <Badge variant="outline" className="text-[10px] font-semibold py-0 px-1.5 border-amber-500/60 text-amber-600 dark:text-amber-400">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {atajo.descripcion}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px] font-bold text-foreground">SHIFT</kbd>
            <span>Mantené presionado <strong className="text-foreground">Shift</strong> para ver este cuadro en cualquier momento.</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

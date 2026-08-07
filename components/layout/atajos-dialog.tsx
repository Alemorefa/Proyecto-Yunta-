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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Keyboard className="h-5 w-5 text-primary" />
            Atajos del Sistema
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Podés presionar la tecla directa desde cualquier lugar del sistema o hacer clic para acceder de inmediato.
          </p>
        </DialogHeader>

        <div className="space-y-2.5 py-2">
          {ATAJOS.map((atajo) => {
            const Icon = atajo.icon;
            const restringido = atajo.soloAdmin && !esAdmin;

            return (
              <button
                key={atajo.tecla}
                type="button"
                onClick={() => ejecutarAtajo(atajo.href, atajo.label, atajo.soloAdmin)}
                className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  restringido
                    ? "cursor-not-allowed opacity-60 bg-muted/30"
                    : "bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/40 hover:shadow-sm"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{atajo.label}</span>
                    {atajo.soloAdmin && (
                      <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{atajo.descripcion}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-muted-foreground font-medium">Tecla</span>
                  <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs font-semibold shadow-xs">
                    {atajo.tecla}
                  </kbd>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

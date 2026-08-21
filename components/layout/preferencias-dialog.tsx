"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Moon, Sun } from "lucide-react";
import { useTema } from "@/lib/theme";
import { useSesionDisplay } from "@/lib/session";
import { actualizarMiPerfil, cambiarMiContrasena } from "@/lib/perfil";

export function PreferenciasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const sesion = useSesionDisplay();
  const { tema, alternar } = useTema();

  const [nombre, setNombre] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmarNueva, setConfirmarNueva] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);

  // Cada vez que se abre, arranca desde los datos más recientes de la sesión.
  useEffect(() => {
    if (!open) return;
    setNombre(sesion.nombre);
    setAvatarUrl(sesion.avatarUrl);
    setActual("");
    setNueva("");
    setConfirmarNueva("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("La imagen es muy pesada (máx. ~1.5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl((ev.target?.result as string) || null);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function guardarPerfil() {
    if (!sesion.usuarioId) return;
    if (!nombre.trim()) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    setGuardandoPerfil(true);
    try {
      await actualizarMiPerfil(sesion.usuarioId, { nombre, avatar_url: avatarUrl });
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error("No se pudo guardar: " + (err as Error).message);
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function guardarContrasena() {
    if (!actual || !nueva) {
      toast.error("Completá la contraseña actual y la nueva");
      return;
    }
    if (nueva.length < 6) {
      toast.error("La nueva contraseña necesita al menos 6 caracteres");
      return;
    }
    if (nueva !== confirmarNueva) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    setCambiandoPass(true);
    try {
      await cambiarMiContrasena(sesion.email, actual, nueva);
      toast.success("Contraseña actualizada");
      setActual("");
      setNueva("");
      setConfirmarNueva("");
    } catch (err) {
      toast.error("No se pudo cambiar: " + (err as Error).message);
    } finally {
      setCambiandoPass(false);
    }
  }

  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preferencias</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Perfil */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navy-800)] text-xl font-semibold text-white"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  inicial
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Cambiar
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
              <div className="min-w-0 flex-1">
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={sesion.email} disabled className="text-muted-foreground" />
            </div>
            <Button size="sm" onClick={guardarPerfil} disabled={guardandoPerfil}>
              {guardandoPerfil ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <Label>Apariencia</Label>
            <button
              type="button"
              onClick={alternar}
              className="mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                {tema === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                Modo {tema === "dark" ? "oscuro" : "claro"}
              </span>
              <span className="text-xs text-muted-foreground">Tocar para cambiar</span>
            </button>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Cambiar contraseña</Label>
            <Input
              type="password"
              placeholder="Contraseña actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Nueva contraseña"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={confirmarNueva}
              onChange={(e) => setConfirmarNueva(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={guardarContrasena} disabled={cambiandoPass}>
              {cambiandoPass ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

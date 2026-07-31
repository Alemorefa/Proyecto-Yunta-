"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

// A esta página te trae el link que manda Supabase por email cuando pedís
// "¿Olvidaste tu contraseña?". Al abrir ese link, Supabase ya te deja con
// una sesión temporal válida solo para elegir la contraseña nueva.
export default function RecuperarContrasenaPage() {
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (contrasena.length < 6) {
      setError("La contraseña necesita al menos 6 caracteres");
      return;
    }
    setCargando(true);
    const { error: err } = await supabase.auth.updateUser({ password: contrasena });
    setCargando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setListo(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h3 className="text-lg font-semibold">Elegir contraseña nueva</h3>

      {listo ? (
        <p className="text-sm text-muted-foreground">
          Listo, tu contraseña quedó actualizada. Ya podés navegar normalmente por la app con la contraseña nueva.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>Contraseña nueva</Label>
            <Input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full">
            Guardar contraseña
          </Button>
        </form>
      )}
    </div>
  );
}

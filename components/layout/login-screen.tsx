"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesion, crearCuenta, recuperarContrasena } from "@/lib/auth";

type Modo = "login" | "crear" | "recuperar";

export function LoginScreen() {
  const [modo, setModo] = useState<Modo>("login");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    const resultado =
      modo === "login"
        ? await iniciarSesion(email, contrasena)
        : modo === "crear"
          ? await crearCuenta(nombre, email, contrasena)
          : await recuperarContrasena(email);

    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (modo === "recuperar") {
      setMensaje("Te mandamos un email con un link para elegir una contraseña nueva.");
    }
  }

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError("");
    setMensaje("");
    setContrasena("");
  }

  const inputClass = "border-white/10 bg-white/5 text-white placeholder:text-white/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--navy-900)] p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[var(--navy-800)] p-6 shadow-xl"
      >
        <h1 className="mb-1 text-xl font-bold text-[var(--sidebar-accent)]">Inventarios</h1>
        <p className="mb-6 text-sm text-white/60">
          {modo === "login" && "Iniciá sesión para continuar"}
          {modo === "crear" && "Creá tu cuenta"}
          {modo === "recuperar" && "Escribí tu email para resetear la contraseña"}
        </p>

        <div className="space-y-3">
          {modo === "crear" && (
            <div>
              <Label className="text-white/80">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <Label className="text-white/80">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          {modo !== "recuperar" && (
            <div>
              <Label className="text-white/80">Contraseña</Label>
              <Input
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {mensaje && <p className="mt-3 text-sm text-green-400">{mensaje}</p>}

        <Button type="submit" disabled={cargando} className="mt-5 w-full">
          {modo === "login" && "Ingresar"}
          {modo === "crear" && "Crear cuenta e ingresar"}
          {modo === "recuperar" && "Mandar link de recuperación"}
        </Button>

        <div className="mt-3 flex flex-col items-center gap-1 text-xs text-white/50">
          {modo === "login" && (
            <>
              <button type="button" onClick={() => cambiarModo("recuperar")} className="underline hover:text-white/80">
                ¿Olvidaste tu contraseña?
              </button>
              <button type="button" onClick={() => cambiarModo("crear")} className="underline hover:text-white/80">
                Crear una cuenta nueva
              </button>
            </>
          )}
          {modo !== "login" && (
            <button type="button" onClick={() => cambiarModo("login")} className="underline hover:text-white/80">
              Volver a iniciar sesión
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

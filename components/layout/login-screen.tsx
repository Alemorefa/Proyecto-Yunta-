"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDB } from "@/lib/db";
import { iniciarSesion, crearAdministradorInicial, recuperarContrasena } from "@/lib/auth";

export function LoginScreen() {
  // Si todavía no hay ningún usuario cargado, la primera pantalla es crear
  // la cuenta de administrador en vez de pedir credenciales de un usuario
  // que no existe.
  const [hayUsuarios] = useState(() => getDB().usuarios.length > 0);
  const [modo, setModo] = useState<"login" | "recuperar">("login");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const resultado =
      modo === "recuperar"
        ? recuperarContrasena(email, contrasena)
        : hayUsuarios
          ? iniciarSesion(email, contrasena)
          : crearAdministradorInicial(nombre, email, contrasena);
    setCargando(false);
    if (!resultado.ok) setError(resultado.error);
  }

  function cambiarModo(nuevo: "login" | "recuperar") {
    setModo(nuevo);
    setError("");
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
          {modo === "recuperar"
            ? "Escribí tu email y una contraseña nueva"
            : hayUsuarios
              ? "Iniciá sesión para continuar"
              : "Creá la cuenta de administrador para empezar"}
        </p>

        <div className="space-y-3">
          {modo === "login" && !hayUsuarios && (
            <div>
              <Label className="text-white/80">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <Label className="text-white/80">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <Label className="text-white/80">{modo === "recuperar" ? "Contraseña nueva" : "Contraseña"}</Label>
            <Input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className={inputClass}
            />
            {modo === "login" && hayUsuarios && (
              <p className="mt-1 text-xs text-white/40">
                Si es tu primer ingreso con este usuario, la contraseña que escribas queda guardada para la próxima
                vez.
              </p>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <Button type="submit" disabled={cargando} className="mt-5 w-full">
          {modo === "recuperar" ? "Guardar contraseña e ingresar" : hayUsuarios ? "Ingresar" : "Crear administrador e ingresar"}
        </Button>

        {hayUsuarios && (
          <button
            type="button"
            onClick={() => cambiarModo(modo === "recuperar" ? "login" : "recuperar")}
            className="mt-3 w-full text-center text-xs text-white/50 underline hover:text-white/80"
          >
            {modo === "recuperar" ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?"}
          </button>
        )}
      </form>
    </div>
  );
}

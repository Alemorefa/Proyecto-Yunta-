"use client";

// Login local del prototipo: valida email + contraseña contra los usuarios
// guardados en localStorage. NO es seguro de verdad (la contraseña queda en
// texto plano en el navegador) — sirve para simular el flujo de "hace falta
// credenciales para entrar" mientras no está conectado Supabase Auth, que
// reemplaza esto por completo (hash de contraseña, sesiones firmadas, RLS).

import { useEffect, useState } from "react";
import { getDB, saveDB, idGen, now, type Usuario } from "./db";
import { setSesionDisplay } from "./session";
import { setRolActivo } from "./role";

const AUTH_KEY = "inventarioLY25_autenticado";

export function estaAutenticado(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_KEY) === "1";
}

function marcarAutenticado() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, "1");
  window.dispatchEvent(new Event("auth-changed"));
}

export function cerrarSesion() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

export function useAutenticado() {
  // null = todavía no se leyó localStorage (evita el flash de login en el primer render)
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    setAuth(estaAutenticado());
    const onChange = () => setAuth(estaAutenticado());
    window.addEventListener("auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return auth;
}

type ResultadoLogin = { ok: true } | { ok: false; error: string };

function loguear(usuario: Usuario) {
  setSesionDisplay({ nombre: usuario.nombre, usuarioId: usuario.id });
  setRolActivo(usuario.rol);
  marcarAutenticado();
}

// Inicia sesión con email + contraseña. Si el usuario existe pero todavía no
// tiene contraseña asignada (usuarios creados antes de esta función, o su
// primer ingreso), la contraseña ingresada ahora queda guardada como la
// suya, para evitar que alguien quede bloqueado sin forma de entrar.
export function iniciarSesion(email: string, contrasena: string): ResultadoLogin {
  const correo = email.trim().toLowerCase();
  if (!correo || !contrasena) return { ok: false, error: "Completá email y contraseña" };

  const db = getDB();
  const usuario = db.usuarios.find((u) => u.email.trim().toLowerCase() === correo);
  if (!usuario) return { ok: false, error: "No encontramos un usuario con ese email" };
  if (usuario.activo === false) return { ok: false, error: "Este usuario está inactivo" };

  if (!usuario.contrasena) {
    usuario.contrasena = contrasena;
    saveDB(db);
  } else if (usuario.contrasena !== contrasena) {
    return { ok: false, error: "Contraseña incorrecta" };
  }

  loguear(usuario);
  return { ok: true };
}

// "Olvidé mi contraseña": como no hay backend ni verificación de email
// todavía, esto simplemente le pisa la contraseña al usuario que coincide
// con ese email y entra directo. No es seguro (cualquiera que sepa el email
// de otro podría resetearle la contraseña) — es aceptable en este
// prototipo local, pero hay que reemplazarlo por un flujo real (con
// verificación) cuando se conecte Supabase Auth.
export function recuperarContrasena(email: string, nuevaContrasena: string): ResultadoLogin {
  const correo = email.trim().toLowerCase();
  if (!correo || !nuevaContrasena) return { ok: false, error: "Completá email y la nueva contraseña" };

  const db = getDB();
  const usuario = db.usuarios.find((u) => u.email.trim().toLowerCase() === correo);
  if (!usuario) return { ok: false, error: "No encontramos un usuario con ese email" };
  if (usuario.activo === false) return { ok: false, error: "Este usuario está inactivo" };

  usuario.contrasena = nuevaContrasena;
  saveDB(db);

  loguear(usuario);
  return { ok: true };
}

// Primer uso de la app (sin ningún usuario cargado todavía): crea la cuenta
// de administrador inicial y entra directo con ella.
export function crearAdministradorInicial(nombre: string, email: string, contrasena: string): ResultadoLogin {
  if (!nombre.trim() || !email.trim() || !contrasena) {
    return { ok: false, error: "Completá nombre, email y contraseña" };
  }
  const db = getDB();
  const usuario: Usuario = {
    id: idGen(),
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    rol: "admin",
    activo: true,
    contrasena,
    fecha_creacion: now(),
  };
  db.usuarios.push(usuario);
  saveDB(db);

  loguear(usuario);
  return { ok: true };
}

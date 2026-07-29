"use client";

// Modo oscuro simple: clase "dark" en <html>, preferencia guardada en
// localStorage. Un script inline en app/layout.tsx aplica la clase antes de
// la hidratación para evitar el parpadeo de tema equivocado.

import { useEffect, useState } from "react";

const THEME_KEY = "inventarioLY25_tema";

export type Tema = "light" | "dark";

export function getTema(): Tema {
  if (typeof window === "undefined") return "light";
  const guardado = window.localStorage.getItem(THEME_KEY) as Tema | null;
  if (guardado === "light" || guardado === "dark") return guardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTema(tema: Tema) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, tema);
  document.documentElement.classList.toggle("dark", tema === "dark");
  window.dispatchEvent(new Event("tema-changed"));
}

export function useTema() {
  const [tema, setTemaState] = useState<Tema>("light");

  useEffect(() => {
    setTemaState(getTema());
    const onChange = () => setTemaState(getTema());
    window.addEventListener("tema-changed", onChange);
    return () => window.removeEventListener("tema-changed", onChange);
  }, []);

  function alternar() {
    setTema(tema === "dark" ? "light" : "dark");
  }

  return { tema, alternar };
}

// Script para pegar inline en <head>/<body> (sin módulos, corre antes de
// hidratar React) que evita el "flash" del tema equivocado al cargar.
export const SCRIPT_ANTI_FLASH = `
(function () {
  try {
    var guardado = localStorage.getItem('${THEME_KEY}');
    var oscuro = guardado === 'dark' || (!guardado && matchMedia('(prefers-color-scheme: dark)').matches);
    if (oscuro) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

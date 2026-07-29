"use client";

// Recordatorio de backup: como todo vive en localStorage, si el navegador
// borra sus datos (o se cambia de compu) se pierde todo. Guardamos la fecha
// del último export en JSON para poder avisar si pasó mucho tiempo.

const BACKUP_KEY = "inventarioLY25_ultimoBackup";
const DIAS_AVISO = 7;

export function marcarBackupHecho() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BACKUP_KEY, new Date().toISOString());
}

export function getUltimoBackup(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BACKUP_KEY);
}

export function backupDesactualizado(): boolean {
  const ultimo = getUltimoBackup();
  if (!ultimo) return true;
  const dias = (Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24);
  return dias > DIAS_AVISO;
}

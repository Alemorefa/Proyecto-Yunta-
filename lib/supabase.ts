"use client";

// Cliente de Supabase (base de datos + autenticación real). Reemplaza,
// tabla por tabla, al localStorage que usaba lib/db.ts. La URL y la clave
// pública viven en variables de entorno (.env.local en tu máquina, y en
// Vercel → Project Settings → Environment Variables para producción) —
// nunca hardcodeadas en el código ni commiteadas.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Falta configurar .env.local (o las env vars en Vercel). Lo avisamos
  // fuerte en vez de fallar en silencio con errores de red confusos.
  // eslint-disable-next-line no-console
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisá .env.local."
  );
}

export const supabase = createClient(url, anonKey);

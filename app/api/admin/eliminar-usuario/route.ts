// Ruta server-side: elimina una cuenta de verdad (auth.users + su fila en
// public.users por el on delete cascade), no solo el perfil. Requiere la
// service_role key, por eso corre acá y no en el navegador.
//
// Solo el SUPER ADMIN puede borrar cuentas (a propósito más restrictivo que
// "cualquier admin" — borrar es irreversible). No se puede borrar a sí
// mismo.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor" },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: quienLlama, error: errorToken } = await admin.auth.getUser(token);
  if (errorToken || !quienLlama.user) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  const { data: perfilQuienLlama, error: errorPerfil } = await admin
    .from("users")
    .select("super_admin")
    .eq("id", quienLlama.user.id)
    .single();
  if (errorPerfil || !perfilQuienLlama?.super_admin) {
    return NextResponse.json({ error: "Solo el super admin puede eliminar usuarios" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const idBorrar = body.id;
  if (!idBorrar) {
    return NextResponse.json({ error: "Falta el id del usuario a eliminar" }, { status: 400 });
  }
  if (idBorrar === quienLlama.user.id) {
    return NextResponse.json({ error: "No podés eliminar tu propia cuenta" }, { status: 400 });
  }

  const { error: errorBorrar } = await admin.auth.admin.deleteUser(idBorrar);
  if (errorBorrar) {
    return NextResponse.json({ error: errorBorrar.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Ruta server-side (nunca corre en el navegador): crea una cuenta nueva con
// una contraseña que elige el admin en el momento (no depende de que llegue
// un email de invitación). Usa la service_role key de Supabase, que tiene
// permisos de administrador total — por eso esta clave vive SOLO acá, como
// variable de entorno del servidor (sin prefijo NEXT_PUBLIC_), y nunca se
// manda al cliente.
//
// Antes de llamar a la API de administración, valida que quien pide la
// creación (el token que manda el navegador) sea un usuario real y además
// tenga role_id = 'admin' en public.users. Así nos aseguramos de que solo
// un admin logueado pueda dar de alta gente nueva.

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
    .select("role_id")
    .eq("id", quienLlama.user.id)
    .single();
  if (errorPerfil || perfilQuienLlama?.role_id !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede dar de alta usuarios" }, { status: 403 });
  }

  let body: { email?: string; nombre?: string; telefono?: string; role_id?: string; contrasena?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const nombre = (body.nombre || "").trim();
  const telefono = (body.telefono || "").trim();
  const contrasena = body.contrasena || "";
  const roleId = body.role_id === "admin" ? "admin" : "usuario";

  if (!email || !nombre) {
    return NextResponse.json({ error: "Nombre y email son obligatorios" }, { status: 400 });
  }
  if (contrasena.length < 6) {
    return NextResponse.json({ error: "La contraseña necesita al menos 6 caracteres" }, { status: 400 });
  }

  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (errorCrear) {
    const mensaje = errorCrear.message.includes("already been registered")
      ? "Ya existe una cuenta con ese email"
      : errorCrear.message;
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }

  // El trigger handle_new_user ya creó la fila en public.users con nombre y
  // rol "usuario" por defecto — acá ajustamos teléfono y el rol elegido.
  if (creado.user) {
    await admin.from("users").update({ telefono: telefono || null, role_id: roleId }).eq("id", creado.user.id);
  }

  return NextResponse.json({ ok: true });
}

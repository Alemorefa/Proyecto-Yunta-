// Revisión diaria del tóner (corre en el servidor, la dispara el cron de
// Vercel — ver vercel.json).
//
// Qué hace: busca las impresoras cuyo cartucho ya se estima agotado y avisa
// por email a los administradores. La regla que pidió el negocio es "si
// nadie lo vio en la app, mandá el mail": por eso saltea los avisos que ya
// tienen visto_en_app = true (alguien abrió la campana y los vio) y los que
// ya tienen email_enviado = true (para no repetir el mismo mail todos los
// días).
//
// Usa la service_role key, que no pasa por RLS — por eso esta ruta está
// protegida con CRON_SECRET: sin ese header no hace nada.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { impresorasConTonerAgotado, type ImpresoraToner, type MovimientoToner } from "@/lib/toner-calculo";

// Sin caché: cada corrida tiene que leer el estado real de la base.
export const dynamic = "force-dynamic";

type FilaAlerta = { printer_id: string; desde_movimiento: string; visto_en_app: boolean; email_enviado: boolean };

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM || "Inventario La Yunta <onboarding@resend.dev>";

  // Vercel Cron manda "Authorization: Bearer <CRON_SECRET>".
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Falta configurar Supabase en el servidor" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Días de duración configurados. Sin esto no se puede estimar nada.
  const { data: config } = await admin.from("settings").select("dias_duracion_toner").eq("id", 1).single();
  const diasEstimados = config?.dias_duracion_toner ?? null;
  if (!diasEstimados) {
    return NextResponse.json({ ok: true, motivo: "Sin duración de cartucho configurada", enviados: 0 });
  }

  // 2) Impresoras con tóner + sus movimientos.
  const [{ data: impresoras }, { data: movimientos }] = await Promise.all([
    admin.from("printers").select("id, modelo, store_id, activa, usa_toner").eq("usa_toner", true).eq("activa", true),
    admin.from("printer_movements").select("printer_id, fecha, tipo"),
  ]);

  const agotadas = impresorasConTonerAgotado(
    (impresoras ?? []) as ImpresoraToner[],
    (movimientos ?? []) as MovimientoToner[],
    diasEstimados
  );
  if (agotadas.length === 0) {
    return NextResponse.json({ ok: true, agotadas: 0, enviados: 0 });
  }

  // 3) Descartar los que ya se vieron en la app o ya se mailearon.
  const { data: alertas } = await admin
    .from("toner_alertas")
    .select("printer_id, desde_movimiento, visto_en_app, email_enviado");

  const yaResueltas = new Set(
    ((alertas ?? []) as FilaAlerta[])
      .filter((a) => a.visto_en_app || a.email_enviado)
      .map((a) => `${a.printer_id}|${a.desde_movimiento}`)
  );

  const paraAvisar = agotadas.filter((a) => !yaResueltas.has(`${a.impresora.id}|${a.desdeMovimiento}`));
  if (paraAvisar.length === 0) {
    return NextResponse.json({ ok: true, agotadas: agotadas.length, enviados: 0, motivo: "Ya avisados" });
  }

  // 4) Destinatarios: administradores activos (incluye al super admin, que
  //    también tiene role_id = 'admin').
  const { data: admins } = await admin.from("users").select("email").eq("role_id", "admin").eq("activo", true);
  const destinatarios = (admins ?? []).map((u) => u.email).filter(Boolean).slice(0, 50);

  if (!resendKey || destinatarios.length === 0) {
    return NextResponse.json({
      ok: true,
      agotadas: agotadas.length,
      enviados: 0,
      motivo: !resendKey ? "Falta RESEND_API_KEY" : "No hay administradores activos con email",
    });
  }

  // 5) Nombres de tienda para que el mail diga dónde está cada impresora.
  const { data: tiendas } = await admin.from("stores").select("id, nombre");
  const nombreTienda = (id: string) => (tiendas ?? []).find((t) => t.id === id)?.nombre || "sin tienda";

  const filas = paraAvisar
    .map(
      (a) =>
        `<li><strong>${a.impresora.modelo}</strong> (${nombreTienda(a.impresora.store_id)}) — ` +
        `${a.diasTranscurridos} días desde la última carga</li>`
    )
    .join("");

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 8px">Tóner agotado</h2>
      <p style="margin:0 0 12px">
        Según la estimación (${diasEstimados} días por cartucho), ${paraAvisar.length === 1 ? "esta impresora necesita" : "estas impresoras necesitan"} recarga:
      </p>
      <ul>${filas}</ul>
      <p style="color:#666; font-size:13px; margin-top:16px">
        Es una estimación por tiempo, no una lectura de la impresora. Cuando registres la recarga en el sistema,
        el medidor vuelve a cero.
      </p>
    </div>
  `;

  // 6) Enviar. La idempotency key evita duplicados si el cron se dispara dos
  //    veces el mismo día por un reintento.
  const claveDia = new Date().toISOString().split("T")[0];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `toner-${claveDia}-${paraAvisar.length}`,
    },
    body: JSON.stringify({
      from: remitente,
      to: destinatarios,
      subject: `Tóner agotado: ${paraAvisar.length} impresora(s) necesitan recarga`,
      html,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    return NextResponse.json({ error: "No se pudo enviar el mail", detalle }, { status: 502 });
  }

  // 7) Marcar como enviados para no repetirlo mañana.
  const ahora = new Date().toISOString();
  await admin.from("toner_alertas").upsert(
    paraAvisar.map((a) => ({
      printer_id: a.impresora.id,
      desde_movimiento: a.desdeMovimiento,
      email_enviado: true,
      fecha_email: ahora,
    })),
    { onConflict: "printer_id,desde_movimiento" }
  );

  return NextResponse.json({ ok: true, agotadas: agotadas.length, enviados: paraAvisar.length });
}

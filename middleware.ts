import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy con nonce por request (patrón oficial de Next.js).
// Es la cabecera más urgente de la auditoría del 2026-08-05: mitiga XSS, que
// es justamente el vector que importa porque el token de sesión de Supabase
// vive en localStorage (no en cookie httpOnly). Si un atacante no puede
// inyectar <script> ajenos a la app, no puede leer ese token.
//
// Va en middleware (no en next.config.mjs) porque el nonce tiene que ser
// aleatorio en cada respuesta — Next.js detecta el nonce en esta cabecera y
// lo aplica solo a los scripts que él mismo genera para hidratar la página.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabaseUrl.replace("https://", "wss://");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Radix/shadcn posicionan popovers y diálogos con style="" inline; sin
    // esto se rompen los menús y selects. El riesgo de XSS vía CSS es bajo
    // comparado con script-src, por eso es un trade-off aceptado.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
    // El escáner QR (html5-qrcode) decodifica en un web worker cargado
    // desde un blob: URL.
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Todo menos assets estáticos y la imagen optimizada de Next — no tiene
    // sentido calcular un nonce para un .png.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

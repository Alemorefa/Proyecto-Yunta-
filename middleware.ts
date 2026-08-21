import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy. Primer intento: nonce por request + strict-dynamic
// (el patrón "de libro" de Next.js) — en la práctica, en el build real de
// Vercel, Next.js NO le puso el nonce a sus propios scripts (webpack.js,
// main-app.js, etc.) y la CSP terminó bloqueando toda la app (pantalla en
// blanco). Puede ser una diferencia de versión o de cómo Next arma los
// chunks en este proyecto — no vale la pena perseguirlo más.
//
// Versión simple y ya probada: 'self' + 'unsafe-inline' para scripts. Sigue
// bloqueando lo importante (que se cargue un <script> desde un dominio
// ajeno), que es el vector real dado que el token vive en localStorage —
// solo no protege contra un script INYECTADO inline dentro del HTML de la
// propia página, un caso más acotado.
export function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabaseUrl.replace("https://", "wss://");

  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // Radix/shadcn posicionan popovers y diálogos con style="" inline; sin
    // esto se rompen los menús y selects.
    `style-src 'self' 'unsafe-inline'`,
    // api.qrserver.com genera la imagen del QR para la etiqueta imprimible.
    `img-src 'self' data: blob: https://api.qrserver.com`,
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

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

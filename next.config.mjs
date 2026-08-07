/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cabeceras de seguridad HTTP (recomendadas por la auditoría del
  // 2026-08-05). La Content-Security-Policy va aparte, en middleware.ts,
  // porque necesita un nonce distinto en cada request — acá van las que son
  // siempre iguales.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Reemplazado en gran parte por frame-ancestors en la CSP, pero
            // lo dejamos para navegadores viejos que no la soportan.
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            // Evita que el navegador "adivine" el tipo de un archivo
            // distinto al declarado (mitiga ataques de MIME sniffing).
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // No manda la URL completa (con posibles IDs/tokens en query)
            // a sitios de terceros cuando se sale de la app.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Desactiva APIs del navegador que la app no usa. Cámara queda
            // habilitada porque Inventario tiene un escáner QR real.
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
          },
          {
            // Refuerza HTTPS explícitamente (Vercel ya lo hace, esto es
            // cinturón y tirantes por si en algún momento cambia el hosting).
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

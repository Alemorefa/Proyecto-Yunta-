import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "sonner";
import { SCRIPT_ANTI_FLASH } from "@/lib/theme";

export const metadata: Metadata = {
  title: "App de Inventarios | Proyecto Yunta",
  description: "Gestión de tiendas, productos y movimientos de stock.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTI_FLASH }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

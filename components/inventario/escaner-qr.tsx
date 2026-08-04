"use client";

// Escáner de QR con la cámara del celular. Solo tiene sentido en mobile (en
// desktop no hay cámara a mano apuntando a una etiqueta), por eso el botón
// se muestra únicamente por debajo del breakpoint "nav" (900px) — mismo
// criterio que ya usa el resto de la app para mostrar cosas solo en mobile.
//
// Al leer un QR (que contiene el código SKU del ítem, ver imprimirEtiqueta
// en app/inventario/page.tsx), navega a /inventario?qr=<codigo> para que la
// pantalla de Inventario abra directo la ficha de ese ítem.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine } from "lucide-react";

const READER_ID = "lector-qr-inventario";

// Tipo mínimo de lo que necesitamos de html5-qrcode (evita cargar sus tipos
// completos acá; la librería se importa dinámicamente más abajo).
type ScannerInstancia = { clear: () => Promise<void> };

export function EscanerQR() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef<ScannerInstancia | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setError("");

    import("html5-qrcode")
      .then(({ Html5QrcodeScanner }) => {
        if (cancelado) return;
        const scanner = new Html5QrcodeScanner(
          READER_ID,
          { fps: 10, qrbox: 250 },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (textoLeido: string) => {
            scanner.clear().catch(() => {});
            setAbierto(false);
            router.push(`/inventario?qr=${encodeURIComponent(textoLeido)}`);
          },
          () => {
            // Se dispara constantemente mientras la cámara no encuentra un
            // QR en el cuadro — no es un error real, se ignora.
          }
        );
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo iniciar la cámara. Revisá los permisos del navegador.");
      });

    return () => {
      cancelado = true;
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [abierto, router]);

  return (
    <>
      <Button variant="outline" className="nav:hidden" onClick={() => setAbierto(true)}>
        <ScanLine className="h-4 w-4" /> Escanear
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear código QR</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Apuntá la cámara al QR pegado en el ítem. La primera vez te va a pedir permiso de cámara.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div id={READER_ID} className="mt-2" />
        </DialogContent>
      </Dialog>
    </>
  );
}

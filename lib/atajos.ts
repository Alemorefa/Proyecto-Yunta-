import { Plus, ArrowLeftRight, ArrowDownCircle, History, LucideIcon } from "lucide-react";

export interface AtajoItem {
  tecla: string;
  label: string;
  descripcion: string;
  href: string;
  icon: LucideIcon;
  soloAdmin: boolean;
}

export const ATAJOS: AtajoItem[] = [
  {
    tecla: "N",
    label: "Nuevo ítem",
    descripcion: "Abre el formulario de alta de nuevo producto",
    href: "/inventario?abrir=nuevo",
    icon: Plus,
    soloAdmin: true,
  },
  {
    tecla: "T",
    label: "Transferencia",
    descripcion: "Inicia un registro de movimiento de transferencia",
    href: "/movimientos?accion=transferencia",
    icon: ArrowLeftRight,
    soloAdmin: true,
  },
  {
    tecla: "B",
    label: "Baja",
    descripcion: "Registra la baja de un activo del inventario",
    href: "/movimientos?accion=baja",
    icon: ArrowDownCircle,
    soloAdmin: true,
  },
  {
    tecla: "H",
    label: "Historial",
    descripcion: "Navega a la lista completa de historial de cambios",
    href: "/historial",
    icon: History,
    soloAdmin: false,
  },
];

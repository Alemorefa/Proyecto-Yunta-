"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeftRight, ChevronDown, Download, MoreVertical, Pencil, Plus, Printer, QrCode, Trash2, Upload, ZoomIn } from "lucide-react";
import { EscanerQR } from "@/components/inventario/escaner-qr";
import { idGen, ESTADOS_ACTIVO, type EstadoActivo } from "@/lib/db";
import {
  listarTiendas,
  listarSectores,
  listarCategorias,
  type Tienda,
  type Sector,
  type Categoria,
} from "@/lib/catalogos";
import {
  listarActivos,
  listarUltimaFotoPorActivo,
  listarProveedores,
  existeCodigoInterno,
  crearActivo,
  actualizarActivo,
  transferirActivo,
  darDeBajaActivo,
  reducirCantidadActivo,
  registrarMovimientoActivo,
  reemplazarFotoActivo,
  buscarOCrearProveedor,
  valorTotalARS,
  valorTotalUSD,
  type Activo,
  type ActivoInput,
  type Proveedor,
} from "@/lib/inventario-data";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { exportarExcel, leerExcel } from "@/lib/excel";
import { cambiarEstadoImpresora, moverImpresoraDeTienda } from "@/lib/impresoras-data";
import { esCategoriaImpresora, sincronizarImpresoraDesdeActivo, usaTonerDeActivo } from "@/lib/vinculo-impresoras";
import { obtenerConfig } from "@/lib/config-data";
import { hoyISO } from "@/lib/fechas";

type FilaImportada = {
  codigo_interno: string;
  nombre: string;
  categoria_id: string | null;
  tienda_id: string | null;
  sector_id: string | null;
  cantidad: number;
  precio_ars: number;
  precio_usd: number;
  estado: EstadoActivo;
  responsable: string;
  observaciones: string;
  estadoFila: "Nuevo" | "Actualiza existente";
  avisos: string[];
};

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

// Campos esenciales para el "botón simple" de alta rápida que pidió el
// administrador: descripción, sector/tienda, cantidad, precio ARS y USD.
// El resto de los campos (código interno, categoría, marca, N° de serie,
// etc.) quedan en una sección "Detalles adicionales" colapsable, opcional.
const ACTIVO_VACIO = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  categoria_id: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  estado: "Bueno" as EstadoActivo,
  fecha_compra: "",
  proveedor: "",
  cantidad: "1",
  precio_ars: "",
  precio_usd: "",
  tienda_id: "",
  sector_id: "",
  responsable: "",
  observaciones: "",
  es_comodato: false,
  foto_url: "",
};

function badgeEstado(estado: EstadoActivo) {
  if (estado === "Baja") return "destructive";
  if (estado === "Nuevo" || estado === "Bueno") return "success";
  if (estado === "Malo") return "warning";
  return "secondary";
}

// La cantidad 0 es un dato válido: el ítem figura en la lista pero
// físicamente no está (se movió a otra sucursal, se devolvió, se consumió).
// Con `parseInt(x) || 1` el cero se tomaba como "vacío" y se guardaba como 1,
// inventando stock que no existe. Solo el campo vacío asume una unidad.
function cantidadDesdeTexto(valor: string): number {
  if (String(valor).trim() === "") return 1;
  const n = parseInt(String(valor), 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

// Redondea a 2 decimales sin arrastrar errores de punto flotante (ej. 1.0049999 -> 1).
function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Autocompletar de precio con la cotización de Configuración: si la persona
// carga un solo precio (ARS o USD) y deja el otro vacío, se calcula solo.
// Apenas la persona escribe algo a mano en el otro campo, deja de
// pisarlo — por eso se trackea con arsTocado/usdTocado en vez de mirar
// nada más si el campo está vacío.
function usdDesdeArs(ars: string, cotizacion: number): string {
  const valor = parseFloat(ars);
  if (!valor || !cotizacion) return "";
  return redondear2(valor / cotizacion).toString();
}

function arsDesdeUsd(usd: string, cotizacion: number): string {
  const valor = parseFloat(usd);
  if (!valor || !cotizacion) return "";
  return redondear2(valor * cotizacion).toString();
}

const PAGE_SIZE = 25;

function InventarioContenido() {
  const searchParams = useSearchParams();
  const [activos, setActivos] = useState<Activo[] | null>(null);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [fotos, setFotos] = useState<Map<string, string>>(new Map());

  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroTenencia, setFiltroTenencia] = useState("todas");
  // Prefijado desde el buscador global del topbar (?buscar=...) o editable a mano.
  const [busqueda, setBusqueda] = useState(searchParams.get("buscar") || "");
  const [limite, setLimite] = useState(PAGE_SIZE);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(ACTIVO_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Cotización actual (ARS por 1 USD, la misma de Configuración) para
  // autocompletar el precio en la otra moneda. arsTocado/usdTocado
  // registran si la persona ya escribió algo a mano en ese campo durante
  // esta apertura del diálogo, para dejar de recalcularlo apenas lo toca.
  const [cotizacion, setCotizacion] = useState<number | null>(null);
  const [arsTocado, setArsTocado] = useState(false);
  const [usdTocado, setUsdTocado] = useState(false);

  // Solo aplica cuando la categoría elegida es "Impresoras": indica si esa
  // impresora lleva cartucho de tóner (se propaga al módulo Impresoras).
  const [usaToner, setUsaToner] = useState(true);

  const [transferir, setTransferir] = useState<Activo | null>(null);
  const [nuevaTienda, setNuevaTienda] = useState("");
  const [nuevoSector, setNuevoSector] = useState("");
  const [obsTransferencia, setObsTransferencia] = useState("");

  const [baja, setBaja] = useState<Activo | null>(null);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [cantidadBaja, setCantidadBaja] = useState(1);

  const [qrActivo, setQrActivo] = useState<Activo | null>(null);
  const [fotoZoom, setFotoZoom] = useState<{ url: string; titulo: string } | null>(null);
  const [accionesMenuId, setAccionesMenuId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<FilaImportada[]>([]);
  const [importando, setImportando] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  async function cargar() {
    const [a, t, s, c, p, f, config] = await Promise.all([
      listarActivos(),
      listarTiendas(),
      listarSectores(),
      listarCategorias(),
      listarProveedores(),
      listarUltimaFotoPorActivo(),
      obtenerConfig(),
    ]);
    setActivos(a);
    setTiendas(t);
    setSectores(s);
    setCategorias(c);
    setProveedores(p);
    setFotos(f);
    setCotizacion(config.cotizacion_usd || null);
  }

  useEffect(() => {
    cargar().catch((err) => toast.error("No se pudo cargar el inventario: " + (err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acceso directo desde los accesos rápidos de Inicio (?abrir=nuevo) o el
  // atajo de teclado "N": abre el diálogo de alta apenas carga la página.
  useEffect(() => {
    if (searchParams.get("abrir") === "nuevo" && esAdmin) {
      abrirNuevo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, esAdmin]);

  // Acceso directo desde el escáner QR (?qr=<codigo>): busca el ítem por su
  // código SKU y abre su ficha directo. El ref evita reabrirla sola cada vez
  // que la lista se recarga (por ejemplo después de guardar un cambio).
  const qrProcesadoRef = useRef<string | null>(null);
  useEffect(() => {
    const codigoQr = searchParams.get("qr");
    if (!codigoQr || !activos) return;
    if (qrProcesadoRef.current === codigoQr) return;
    qrProcesadoRef.current = codigoQr;
    const match = activos.find((a) => a.codigo_interno.toLowerCase() === codigoQr.toLowerCase());
    if (match) {
      abrirEditar(match);
    } else {
      toast.error(`No se encontró ningún ítem con el código "${codigoQr}"`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activos]);

  const activosFiltrados = useMemo(() => {
    if (!activos) return [];
    const q = busqueda.trim().toLowerCase();
    return activos.filter((a) => {
      if (a.estado === "Baja" && filtroEstado !== "Baja") return false;
      if (filtroTienda !== "todas" && a.store_id !== filtroTienda) return false;
      if (filtroCategoria !== "todas" && a.category_id !== filtroCategoria) return false;
      if (filtroEstado !== "todas" && a.estado !== filtroEstado) return false;
      
      const esComodato = a.es_comodato ?? (
        (a.observaciones || "").toLowerCase().includes("comodato") ||
        (a.nombre || "").toLowerCase().includes("comodato")
      );
      if (filtroTenencia === "propios" && esComodato) return false;
      if (filtroTenencia === "comodato" && !esComodato) return false;

      if (q) {
        const coincide =
          a.nombre.toLowerCase().includes(q) ||
          a.codigo_interno.toLowerCase().includes(q) ||
          (a.descripcion || "").toLowerCase().includes(q) ||
          (a.numero_serie || "").toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [activos, filtroTienda, filtroCategoria, filtroEstado, filtroTenencia, busqueda]);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, filtroCategoria, filtroEstado, filtroTenencia, busqueda]);

  if (!activos) return null;

  const activosVisibles = activosFiltrados.slice(0, limite);

  const nombreTienda = (id?: string | null) => tiendas.find((t) => t.id === id)?.nombre || "-";
  const nombreSector = (id?: string | null) => sectores.find((s) => s.id === id)?.nombre || "-";
  const nombreCategoria = (id?: string | null) => categorias.find((c) => c.id === id)?.nombre || "-";
  const nombreProveedor = (id?: string | null) => proveedores.find((p) => p.id === id)?.nombre || "";
  const sectoresDeTienda = (tiendaId: string) => sectores.filter((s) => s.store_id === tiendaId);

  function abrirNuevo() {
    setEditId(null);
    setForm(ACTIVO_VACIO);
    setArsTocado(false);
    setUsdTocado(false);
    setUsaToner(true);
    setOpen(true);
  }

  function abrirEditar(a: Activo) {
    setEditId(a.id);
    const esComodato = a.es_comodato ?? (
      (a.observaciones || "").toLowerCase().includes("comodato") ||
      (a.nombre || "").toLowerCase().includes("comodato")
    );
    setForm({
      codigo_interno: a.codigo_interno,
      nombre: a.nombre,
      descripcion: a.descripcion || "",
      categoria_id: a.category_id || "",
      marca: a.marca || "",
      modelo: a.modelo || "",
      numero_serie: a.numero_serie || "",
      estado: a.estado,
      fecha_compra: a.fecha_compra || "",
      proveedor: nombreProveedor(a.supplier_id),
      cantidad: (a.cantidad ?? 1).toString(),
      precio_ars: a.precio_ars?.toString() || "",
      precio_usd: a.precio_usd?.toString() || "",
      tienda_id: a.store_id || "",
      sector_id: a.sector_id || "",
      responsable: a.responsable || "",
      observaciones: a.observaciones || "",
      es_comodato: esComodato,
      foto_url: fotos.get(a.id) || "",
    });
    // Un ítem existente ya tiene sus precios cargados a mano — no
    // recalcularlos solos apenas se abre para editar otra cosa.
    setArsTocado(!!a.precio_ars);
    setUsdTocado(!!a.precio_usd);
    // Si es una impresora vinculada, trae si lleva tóner para mostrar el
    // check como está guardado hoy.
    setUsaToner(true);
    usaTonerDeActivo(a.printer_id)
      .then(setUsaToner)
      .catch(() => setUsaToner(true));
    setOpen(true);
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("La imagen es muy pesada (máx. ~1.5MB en este prototipo local)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, foto_url: (ev.target?.result as string) || "" }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error("La descripción del ítem es obligatoria");
      return;
    }
    if (form.fecha_compra && form.fecha_compra > hoyISO()) {
      toast.error("La fecha de compra no puede ser futura");
      return;
    }

    setGuardando(true);
    try {
      const codigoFinal = form.codigo_interno.trim() || idGen().toUpperCase();
      const duplicado = await existeCodigoInterno(codigoFinal, editId || undefined);
      if (duplicado) {
        toast.error(`Ya existe un ítem con el código "${codigoFinal}". Usá otro código interno.`);
        setGuardando(false);
        return;
      }

      const supplierId = await buscarOCrearProveedor(form.proveedor);

      const input: ActivoInput = {
        codigo_interno: codigoFinal,
        nombre: form.nombre,
        descripcion: form.descripcion,
        categoria_id: form.categoria_id || null,
        marca: form.marca,
        modelo: form.modelo,
        numero_serie: form.numero_serie,
        estado: form.estado,
        fecha_compra: form.fecha_compra,
        supplier_id: supplierId,
        cantidad: cantidadDesdeTexto(form.cantidad),
        precio_ars: parseFloat(form.precio_ars) || 0,
        precio_usd: parseFloat(form.precio_usd) || 0,
        tienda_id: form.tienda_id || null,
        sector_id: form.sector_id || null,
        responsable: form.responsable,
        observaciones: form.observaciones,
        es_comodato: form.es_comodato,
      };

      let assetId = editId;
      let guardado: Activo | null = null;

      if (editId) {
        const anterior = activos?.find((a) => a.id === editId);
        const estadoCambio = anterior?.estado !== input.estado;
        guardado = await actualizarActivo(editId, input);
        await registrarMovimientoActivo({
          activo_id: editId,
          accion: estadoCambio ? "Cambio de estado" : "Modificación",
          observacion: estadoCambio ? `Estado: ${input.estado}` : "Datos actualizados",
          usuario_id: sesion.usuarioId ?? null,
        });
        toast.success("Ítem actualizado");
      } else {
        const nuevo = await crearActivo(input);
        assetId = nuevo.id;
        guardado = nuevo;
        await registrarMovimientoActivo({
          activo_id: nuevo.id,
          accion: "Alta",
          observacion: "Alta de ítem",
          usuario_id: sesion.usuarioId ?? null,
        });
        toast.success("Ítem agregado");
      }

      if (assetId) await reemplazarFotoActivo(assetId, form.foto_url || null);

      // Si es de categoría "Impresoras", crea/actualiza la impresora
      // vinculada en el módulo Impresoras para que quede igual.
      if (guardado && esCategoriaImpresora(categorias, guardado.category_id)) {
        await sincronizarImpresoraDesdeActivo(guardado, usaToner);
      }

      await cargar();
      setOpen(false);
    } catch (err) {
      toast.error("No se pudo guardar el ítem: " + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  function abrirTransferencia(a: Activo) {
    setTransferir(a);
    setNuevaTienda(a.store_id || "");
    setNuevoSector(a.sector_id || "");
    setObsTransferencia("");
  }

  async function confirmarTransferencia() {
    if (!transferir || !nuevaTienda) {
      toast.error("Selecciona la tienda destino");
      return;
    }
    try {
      const origenTienda = transferir.store_id;
      const origenSector = transferir.sector_id;
      await transferirActivo(transferir.id, { store_id: nuevaTienda, sector_id: nuevoSector || null });
      await registrarMovimientoActivo({
        activo_id: transferir.id,
        accion: origenTienda !== nuevaTienda ? "Transferencia" : "Cambio de sector",
        observacion: obsTransferencia || "Transferencia de ítem",
        store_origen_id: origenTienda,
        store_destino_id: nuevaTienda,
        sector_origen_id: origenSector,
        sector_destino_id: nuevoSector || null,
        usuario_id: sesion.usuarioId ?? null,
      });
      if (transferir.printer_id && origenTienda !== nuevaTienda) {
        await moverImpresoraDeTienda(transferir.printer_id, nuevaTienda);
      }
      await cargar();
      setTransferir(null);
      toast.success("Ítem transferido");
    } catch (err) {
      toast.error("No se pudo transferir el ítem: " + (err as Error).message);
    }
  }

  function abrirBaja(a: Activo) {
    setBaja(a);
    setMotivoBaja("");
    setCantidadBaja(1);
  }

  async function confirmarBaja() {
    if (!baja || !motivoBaja.trim()) {
      toast.error("Indica el motivo de la baja");
      return;
    }
    const totalActual = baja.cantidad ?? 1;
    const aDarDeBaja = totalActual > 1 ? cantidadBaja : totalActual;
    if (aDarDeBaja < 1 || aDarDeBaja > totalActual) {
      toast.error("Cantidad inválida");
      return;
    }
    try {
      const esBajaTotal = aDarDeBaja >= totalActual;
      if (esBajaTotal) {
        await darDeBajaActivo(baja.id, motivoBaja);
      } else {
        await reducirCantidadActivo(baja.id, totalActual - aDarDeBaja);
      }
      await registrarMovimientoActivo({
        activo_id: baja.id,
        accion: "Baja",
        observacion:
          totalActual > 1 ? `${aDarDeBaja} de ${totalActual} unidad(es) — ${motivoBaja.trim()}` : motivoBaja.trim(),
        usuario_id: sesion.usuarioId ?? null,
      });
      if (baja.printer_id && esBajaTotal) {
        await cambiarEstadoImpresora(baja.printer_id, false);
      }
      await cargar();
      setBaja(null);
      toast.success(esBajaTotal ? "Ítem dado de baja" : "Baja parcial registrada");
    } catch (err) {
      toast.error("No se pudo dar de baja el ítem: " + (err as Error).message);
    }
  }

  function imprimirEtiqueta(a: Activo) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      a.codigo_interno
    )}`;
    const ventana = window.open("", "_blank", "width=400,height=500");
    if (!ventana) {
      toast.error("El navegador bloqueó la ventana de impresión (revisá el bloqueador de pop-ups)");
      return;
    }
    ventana.document.write(`
      <html>
        <head>
          <title>Etiqueta ${a.codigo_interno}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 24px; }
            img { margin-bottom: 12px; }
            h2 { margin: 0 0 4px; font-size: 16px; }
            p { margin: 0; font-family: monospace; font-size: 14px; color: #555; }
          </style>
        </head>
        <body>
          <img src="${qrUrl}" width="220" height="220" alt="QR" />
          <h2>${a.nombre}</h2>
          <p>${a.codigo_interno}</p>
        </body>
      </html>
    `);
    ventana.document.close();
    ventana.onload = () => ventana.print();
  }

  function exportar() {
    const filas = activosFiltrados.map((a) => ({
      "Código SKU": a.codigo_interno,
      Descripción: a.nombre,
      Categoría: nombreCategoria(a.category_id),
      Tienda: nombreTienda(a.store_id),
      Sector: nombreSector(a.sector_id),
      Cantidad: a.cantidad ?? 1,
      "Precio unitario ARS": a.precio_ars ?? 0,
      "Precio unitario USD": a.precio_usd ?? 0,
      "Total ARS": valorTotalARS(a),
      "Total USD": valorTotalUSD(a),
      Estado: a.estado,
      Tenencia: (a.es_comodato || (a.observaciones || "").toLowerCase().includes("comodato") || a.nombre.toLowerCase().includes("comodato")) ? "Comodato / Prestado" : "Propio",
      Responsable: a.responsable || "",
      Observaciones: a.observaciones || "",
    }));
    exportarExcel(filas, `inventario-${new Date().toISOString().split("T")[0]}`, "Inventario");
    toast.success("Excel generado");
  }

  async function handleImportarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activos) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const filas = await leerExcel(file);
      if (filas.length === 0) {
        toast.error("El archivo no tiene filas para importar");
        return;
      }

      const codigosVistos = new Set<string>();
      const preview: FilaImportada[] = filas.map((row) => {
        const avisos: string[] = [];

        const codigo =
          pick(row, ["Código SKU", "Codigo SKU", "SKU", "Código interno", "Codigo interno", "codigo_interno", "Código"]) ||
          idGen().toUpperCase();

        const tiendaTexto = pick(row, ["Tienda"]);
        const tienda = tiendas.find((t) => t.nombre.toLowerCase() === tiendaTexto.toLowerCase());
        if (tiendaTexto && !tienda) avisos.push(`Tienda "${tiendaTexto}" no encontrada`);

        const sectorTexto = pick(row, ["Sector"]);
        const sector = tienda
          ? sectores.find((s) => s.store_id === tienda.id && s.nombre.toLowerCase() === sectorTexto.toLowerCase())
          : undefined;
        if (sectorTexto && tienda && !sector) avisos.push(`Sector "${sectorTexto}" no encontrado en esa tienda`);

        const categoriaTexto = pick(row, ["Categoría", "Categoria"]);
        const categoria = categorias.find((c) => c.nombre.toLowerCase() === categoriaTexto.toLowerCase());
        if (categoriaTexto && !categoria) avisos.push(`Categoría "${categoriaTexto}" no encontrada`);

        const estadoTexto = pick(row, ["Estado"]) as EstadoActivo;
        const estado = ESTADOS_ACTIVO.includes(estadoTexto) ? estadoTexto : "Bueno";

        if (codigosVistos.has(codigo.toLowerCase())) {
          avisos.push("Código repetido dentro del mismo archivo (se importa igual, va a pisar la fila anterior)");
        }
        codigosVistos.add(codigo.toLowerCase());

        const yaExiste = activos.some((a) => a.codigo_interno.toLowerCase() === codigo.toLowerCase());

        return {
          codigo_interno: codigo,
          nombre: pick(row, ["Descripción", "Descripcion", "Nombre"]),
          categoria_id: categoria?.id || null,
          tienda_id: tienda?.id || null,
          sector_id: sector?.id || null,
          cantidad: cantidadDesdeTexto(pick(row, ["Cantidad"])),
          precio_ars: parseFloat(pick(row, ["Precio unitario ARS", "Precio ARS"])) || 0,
          precio_usd: parseFloat(pick(row, ["Precio unitario USD", "Precio USD"])) || 0,
          estado,
          responsable: pick(row, ["Responsable"]),
          observaciones: pick(row, ["Observaciones"]),
          estadoFila: yaExiste ? "Actualiza existente" : "Nuevo",
          avisos,
        } as FilaImportada;
      });

      setImportPreview(preview);
      setImportOpen(true);
    } catch (err) {
      toast.error("No se pudo leer el archivo: " + (err as Error).message);
    }
  }

  async function confirmarImportacion() {
    if (!activos) return;
    setImportando(true);
    let creados = 0;
    let actualizados = 0;
    try {
      for (const fila of importPreview) {
        if (!fila.nombre) continue;
        const existente = activos.find((a) => a.codigo_interno.toLowerCase() === fila.codigo_interno.toLowerCase());
        const input: ActivoInput = {
          codigo_interno: fila.codigo_interno,
          nombre: fila.nombre,
          descripcion: "",
          categoria_id: fila.categoria_id,
          marca: "",
          modelo: "",
          numero_serie: "",
          estado: fila.estado,
          fecha_compra: "",
          supplier_id: null,
          cantidad: fila.cantidad,
          precio_ars: fila.precio_ars,
          precio_usd: fila.precio_usd,
          tienda_id: fila.tienda_id,
          sector_id: fila.sector_id,
          responsable: fila.responsable,
          observaciones: fila.observaciones,
        };

        if (existente) {
          await actualizarActivo(existente.id, input);
          await registrarMovimientoActivo({
            activo_id: existente.id,
            accion: "Modificación",
            observacion: "Actualizado por importación de Excel",
            usuario_id: sesion.usuarioId ?? null,
          });
          actualizados++;
        } else {
          const nuevo = await crearActivo(input);
          await registrarMovimientoActivo({
            activo_id: nuevo.id,
            accion: "Alta",
            observacion: "Alta por importación de Excel",
            usuario_id: sesion.usuarioId ?? null,
          });
          creados++;
        }
      }

      await cargar();
      setImportOpen(false);
      setImportPreview([]);
      toast.success(`Importación lista: ${creados} nuevos, ${actualizados} actualizados`);
    } catch (err) {
      toast.error("La importación se cortó: " + (err as Error).message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Inventario</h3>
        <div className="flex flex-wrap gap-2">
          <EscanerQR />
          <Button variant="outline" onClick={exportar}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
          {esAdmin && (
            <>
              <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar Excel
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportarArchivo}
              />
              <Button onClick={abrirNuevo}>
                <Plus className="h-4 w-4" /> Agregar ítem
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por descripción, código SKU o de barra..."
          className="w-full sm:w-64"
        />
        <Select value={filtroTienda} onValueChange={setFiltroTienda}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tienda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las tiendas</SelectItem>
            {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los estados</SelectItem>
            {ESTADOS_ACTIVO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroTenencia} onValueChange={setFiltroTenencia}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tenencia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las tenencias</SelectItem>
            <SelectItem value="propios">Bienes Propios</SelectItem>
            <SelectItem value="comodato">En Comodato / Prestados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto max-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 p-1 sm:p-2 nav:hidden"></TableHead>
                <TableHead className="hidden nav:table-cell w-12 p-2"></TableHead>
                <TableHead className="p-2">Descripción</TableHead>
                <TableHead className="p-2">Categoría</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Tienda / Sector</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Cant.</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Precio unit.</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Total</TableHead>
                <TableHead className="hidden nav:table-cell p-2">Estado</TableHead>
                <TableHead className="hidden nav:table-cell p-2">QR</TableHead>
                {esAdmin && <TableHead className="w-10 text-right p-1 sm:p-2">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={esAdmin ? 11 : 10} className="text-center text-muted-foreground">
                    No hay ítems registrados
                  </TableCell>
                </TableRow>
              )}
              {activosVisibles.map((a) => {
                const expandido = expandidos.has(a.id);
                const esComodato = a.es_comodato ?? (
                  (a.observaciones || "").toLowerCase().includes("comodato") ||
                  (a.nombre || "").toLowerCase().includes("comodato")
                );
                return (
                  <Fragment key={a.id}>
                    <TableRow className={expandido ? "bg-accent/30 dark:bg-zinc-800/50 border-l-4 border-l-primary shadow-sm" : ""}>
                      <TableCell className="w-8 p-1 sm:p-2 nav:hidden">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpandido(a.id)}>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>
                      <TableCell className="hidden nav:table-cell w-12 p-2">
                        {fotos.get(a.id) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fotos.get(a.id)} alt={a.nombre} className="h-9 w-9 rounded-md object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-muted" />
                        )}
                      </TableCell>
                      <TableCell className="p-2 max-w-[130px] sm:max-w-[220px] truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm truncate block" title={a.nombre}>
                            {a.nombre}
                          </span>
                          {esComodato && (
                            <Badge variant="outline" className="px-1 py-0 text-[9px] font-medium border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 shrink-0">
                              Comodato
                            </Badge>
                          )}
                        </div>
                        {a.codigo_interno && (
                          <span className="font-mono text-[10px] text-muted-foreground block truncate">{a.codigo_interno}</span>
                        )}
                      </TableCell>
                      <TableCell className="p-2 max-w-[95px] sm:max-w-[140px] truncate">
                        <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] font-normal border-muted-foreground/30 truncate max-w-full inline-block">
                          {nombreCategoria(a.category_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden nav:table-cell p-2">
                        {nombreTienda(a.store_id)} <span className="text-muted-foreground">/ {nombreSector(a.sector_id)}</span>
                      </TableCell>
                      <TableCell className="hidden nav:table-cell p-2">{a.cantidad ?? 1}</TableCell>
                      <TableCell className="hidden text-xs nav:table-cell p-2">
                        {a.precio_ars ? `$ ${a.precio_ars.toLocaleString("es-AR")}` : ""}
                        {a.precio_ars && a.precio_usd ? " / " : ""}
                        {a.precio_usd ? `US$ ${a.precio_usd.toLocaleString("es-AR")}` : ""}
                      </TableCell>
                      <TableCell className="hidden text-xs font-medium nav:table-cell p-2">
                        {a.precio_ars ? `$ ${valorTotalARS(a).toLocaleString("es-AR")}` : ""}
                        {a.precio_ars && a.precio_usd ? " / " : ""}
                        {a.precio_usd ? `US$ ${valorTotalUSD(a).toLocaleString("es-AR")}` : ""}
                      </TableCell>
                      <TableCell className="hidden nav:table-cell p-2">
                        <Badge variant={badgeEstado(a.estado)}>{a.estado}</Badge>
                      </TableCell>
                      <TableCell className="hidden nav:table-cell p-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQrActivo(a)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      {esAdmin && (
                        <TableCell className="w-10 text-right p-1 sm:p-2">
                          <div className="hidden lg:flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditar(a)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirTransferencia(a)} title="Transferir">
                              <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={a.estado === "Baja"}
                              onClick={() => abrirBaja(a)}
                              title="Dar de baja"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="relative lg:hidden inline-block text-left">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setAccionesMenuId(accionesMenuId === a.id ? null : a.id)}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {accionesMenuId === a.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setAccionesMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-xl opacity-100 p-1 text-xs">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                                    onClick={() => {
                                      setAccionesMenuId(null);
                                      abrirEditar(a);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left transition-colors"
                                    onClick={() => {
                                      setAccionesMenuId(null);
                                      abrirTransferencia(a);
                                    }}
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" />
                                    <span>Transferir</span>
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 hover:bg-zinc-800 text-left disabled:opacity-50 text-red-400 hover:text-red-300 transition-colors"
                                    disabled={a.estado === "Baja"}
                                    onClick={() => {
                                      setAccionesMenuId(null);
                                      abrirBaja(a);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Dar de baja</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandido && (
                      <TableRow className={`nav:hidden transition-all duration-200 ease-in-out ${expandido ? "bg-accent/30 dark:bg-zinc-800/50 border-l-4 border-l-primary" : ""}`}>
                        <TableCell colSpan={esAdmin ? 4 : 3} className="bg-muted/30 p-3 max-w-full overflow-hidden">
                          {(() => {
                            const fotoUrl = fotos.get(a.id);
                            return (
                              <div className="flex flex-row items-start justify-between gap-3 w-full max-w-full overflow-hidden">
                                {/* Bloque de datos textuales a la IZQUIERDA */}
                                <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-2 text-xs break-words whitespace-normal">
                                  <div className="col-span-2 min-w-0 break-words whitespace-normal">
                                    <span className="text-muted-foreground font-medium">Tienda/Sector: </span>
                                    <span className="break-words">{nombreTienda(a.store_id)} / {nombreSector(a.sector_id)}</span>
                                  </div>
                                  <div className="min-w-0 break-words">
                                    <span className="text-muted-foreground font-medium">Cantidad: </span>
                                    {a.cantidad ?? 1}
                                  </div>
                                  <div className="min-w-0 break-words">
                                    <span className="text-muted-foreground font-medium">Precio unit.: </span>
                                    {a.precio_ars ? `$ ${a.precio_ars.toLocaleString("es-AR")}` : ""}
                                    {a.precio_ars && a.precio_usd ? " / " : ""}
                                    {a.precio_usd ? `US$ ${a.precio_usd.toLocaleString("es-AR")}` : ""}
                                  </div>
                                  <div className="min-w-0 break-words">
                                    <span className="text-muted-foreground font-medium">Total: </span>
                                    {a.precio_ars ? `$ ${valorTotalARS(a).toLocaleString("es-AR")}` : ""}
                                    {a.precio_ars && a.precio_usd ? " / " : ""}
                                    {a.precio_usd ? `US$ ${valorTotalUSD(a).toLocaleString("es-AR")}` : ""}
                                  </div>
                                  <div className="min-w-0 break-words">
                                    <span className="text-muted-foreground font-medium">Estado: </span>
                                    <Badge variant={badgeEstado(a.estado)}>{a.estado}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground font-medium">QR: </span>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQrActivo(a)}>
                                      <QrCode className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Foto a la DERECHA */}
                                {fotoUrl && (
                                  <div
                                    className="relative group shrink-0 cursor-pointer rounded-lg overflow-hidden border bg-background shadow-sm hover:opacity-90 transition-opacity"
                                    onClick={() => setFotoZoom({ url: fotoUrl, titulo: a.nombre })}
                                    title="Tocar para ampliar imagen"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={fotoUrl}
                                      alt={a.nombre}
                                      loading="lazy"
                                      className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-md"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                      <ZoomIn className="h-5 w-5 drop-shadow" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {activosFiltrados.length > activosVisibles.length && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" onClick={() => setLimite((l) => l + PAGE_SIZE)}>
            Cargar más ({activosFiltrados.length - activosVisibles.length} restantes)
          </Button>
        </div>
      )}

      {/* Alta / Edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar ítem" : "Agregar ítem"}</DialogTitle>
          </DialogHeader>

          {/* Campos esenciales: lo que pidió el admin para el alta rápida */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Descripción</Label>
              <Input
                autoFocus
                placeholder="Ej: Cámaras de seguridad"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label>Tienda</Label>
              <Select value={form.tienda_id} onValueChange={(v) => setForm({ ...form, tienda_id: v, sector_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sector</Label>
              <Select value={form.sector_id} onValueChange={(v) => setForm({ ...form, sector_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {sectoresDeTienda(form.tienda_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min={0} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">
                Poné 0 si el ítem figura en la lista pero físicamente no está.
              </p>
            </div>
            <div />
            <div>
              <Label>Precio unitario (ARS)</Label>
              <Input
                type="number"
                value={form.precio_ars}
                onChange={(e) => {
                  const valor = e.target.value;
                  setArsTocado(true);
                  setForm((f) => ({
                    ...f,
                    precio_ars: valor,
                    precio_usd: !usdTocado && cotizacion ? usdDesdeArs(valor, cotizacion) : f.precio_usd,
                  }));
                }}
              />
            </div>
            <div>
              <Label>Precio unitario (USD)</Label>
              <Input
                type="number"
                value={form.precio_usd}
                onChange={(e) => {
                  const valor = e.target.value;
                  setUsdTocado(true);
                  setForm((f) => ({
                    ...f,
                    precio_usd: valor,
                    precio_ars: !arsTocado && cotizacion ? arsDesdeUsd(valor, cotizacion) : f.precio_ars,
                  }));
                }}
              />
            </div>
            {cotizacion && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Cotización actual: 1 USD = $ {cotizacion.toLocaleString("es-AR")}. Completá un precio y el otro se
                calcula solo (se puede pisar a mano).
              </p>
            )}

            <label className="sm:col-span-2 flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 hover:bg-accent/20 transition-colors">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded accent-[var(--navy-800)]"
                checked={form.es_comodato}
                onChange={(e) => setForm({ ...form, es_comodato: e.target.checked })}
              />
              <div className="text-sm">
                <span className="font-medium text-xs sm:text-sm">Bien en Comodato / Prestado</span>
                <span className="block text-[11px] text-muted-foreground">
                  Marcar si el equipo pertenece a un banco o proveedor externo (ej. Posnet Clover, cartelería de marca).
                </span>
              </div>
            </label>
          </div>

          {/* Detalles adicionales: opcionales, colapsados por defecto */}
          <details className="rounded-md border px-3 py-2" open={!!editId}>
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
              Detalles adicionales (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Código SKU</Label>
                <Input
                  placeholder="Se genera automático si lo dejás vacío"
                  value={form.codigo_interno}
                  onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Solo para impresoras: define si se le lleva el medidor de tóner */}
                {esCategoriaImpresora(categorias, form.categoria_id) && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--navy-800)]"
                      checked={usaToner}
                      onChange={(e) => setUsaToner(e.target.checked)}
                    />
                    <span className="text-sm">
                      Lleva cartucho de tóner
                      <span className="block text-xs text-muted-foreground">
                        Se le calcula el medidor y avisa cuando se estima agotado.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as EstadoActivo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_ACTIVO.filter((e) => e !== "Baja").map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marca</Label>
                <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
              </div>
              <div>
                <Label>Código de Barra</Label>
                <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
              </div>
              <div>
                <Label>Fecha de compra</Label>
                <Input
                  type="date"
                  max={hoyISO()}
                  value={form.fecha_compra}
                  onChange={(e) => setForm({ ...form, fecha_compra: e.target.value })}
                />
              </div>
              <div>
                <Label>Responsable</Label>
                <Input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Observaciones</Label>
                <Input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-3">
                  {form.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.foto_url} alt="Vista previa" className="h-16 w-16 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      Sin foto
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <Input type="file" accept="image/*" onChange={handleFoto} className="max-w-xs" />
                    {form.foto_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="self-start"
                        onClick={() => setForm({ ...form, foto_url: "" })}
                      >
                        Quitar foto
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se guarda junto con el activo en Supabase (todavía como imagen embebida, no en Storage — eso queda
                  como mejora pendiente).
                </p>
              </div>
            </div>
          </details>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transferencia */}
      <Dialog open={!!transferir} onOpenChange={(v) => !v && setTransferir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir &quot;{transferir?.nombre}&quot;</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tienda destino</Label>
              <Select value={nuevaTienda} onValueChange={(v) => { setNuevaTienda(v); setNuevoSector(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sector destino</Label>
              <Select value={nuevoSector} onValueChange={setNuevoSector}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {sectoresDeTienda(nuevaTienda).map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observación</Label>
              <Input
                value={obsTransferencia}
                placeholder="Ej: Equipo trasladado por renovación del parque informático"
                onChange={(e) => setObsTransferencia(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTransferir(null)}>Cancelar</Button>
            <Button onClick={confirmarTransferencia}>Confirmar Transferencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baja */}
      <Dialog open={!!baja} onOpenChange={(v) => !v && setBaja(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja &quot;{baja?.nombre}&quot;</DialogTitle>
          </DialogHeader>
          {baja && (baja.cantidad ?? 1) > 1 && (
            <div>
              <Label>Cantidad a dar de baja (de {baja.cantidad})</Label>
              <Input
                type="number"
                min={1}
                max={baja.cantidad ?? 1}
                value={cantidadBaja}
                onChange={(e) => setCantidadBaja(Math.max(1, Math.min(baja.cantidad ?? 1, parseInt(e.target.value) || 1)))}
              />
            </div>
          )}
          <div>
            <Label>Motivo</Label>
            <Input
              value={motivoBaja}
              placeholder="Ej: Daño físico irreversible"
              onChange={(e) => setMotivoBaja(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBaja(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarBaja}>Confirmar Baja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR */}
      <Dialog open={!!qrActivo} onOpenChange={(v) => !v && setQrActivo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR de &quot;{qrActivo?.nombre}&quot;</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrActivo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  qrActivo.codigo_interno
                )}`}
                alt={`QR ${qrActivo.codigo_interno}`}
                width={220}
                height={220}
              />
            )}
            <p className="font-mono text-sm">{qrActivo?.codigo_interno}</p>
            <p className="text-center text-xs text-muted-foreground">
              Al escanearlo se lee el código interno del ítem. Se genera con un servicio público (requiere
              internet); más adelante se puede reemplazar por una librería que lo genere sin conexión.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setQrActivo(null)}>Cerrar</Button>
            <Button onClick={() => qrActivo && imprimirEtiqueta(qrActivo)}>
              <Printer className="h-4 w-4" /> Imprimir etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vista previa de importación */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa de importación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {importPreview.filter((f) => f.estadoFila === "Nuevo").length} ítems nuevos,{" "}
            {importPreview.filter((f) => f.estadoFila === "Actualiza existente").length} van a actualizar un ítem
            existente (mismo código SKU). Revisá los avisos antes de confirmar.
          </p>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Avisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.map((f, i) => (
                  <TableRow key={`${f.codigo_interno}-${i}`}>
                    <TableCell className="font-mono text-xs">{f.codigo_interno}</TableCell>
                    <TableCell>{f.nombre || <span className="text-destructive">Sin descripción</span>}</TableCell>
                    <TableCell>{tiendas.find((t) => t.id === f.tienda_id)?.nombre || "-"}</TableCell>
                    <TableCell>{f.cantidad}</TableCell>
                    <TableCell>
                      <Badge variant={f.estadoFila === "Nuevo" ? "success" : "info"}>{f.estadoFila}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-amber-600">{f.avisos.join(" · ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarImportacion} disabled={importando}>
              {importando ? "Importando..." : "Confirmar importación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de foto en alta resolución / zoom */}
      <Dialog open={!!fotoZoom} onOpenChange={(v) => !v && setFotoZoom(null)}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="truncate">{fotoZoom?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-2 bg-black/5 rounded-md overflow-hidden">
            {fotoZoom?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoZoom.url}
                alt={fotoZoom.titulo}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-md shadow-md"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFotoZoom(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function InventarioPage() {
  return (
    <Suspense fallback={null}>
      <InventarioContenido />
    </Suspense>
  );
}

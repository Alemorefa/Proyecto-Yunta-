"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeftRight, Download, Pencil, Plus, Printer, QrCode, Trash2, Upload } from "lucide-react";
import {
  getDB,
  saveDB,
  idGen,
  now,
  registrarMovimiento,
  valorTotalARS,
  valorTotalUSD,
  ESTADOS_ACTIVO,
  type Activo,
  type DB,
  type EstadoActivo,
} from "@/lib/db";
import { useRolActivo } from "@/lib/role";
import { useSesionDisplay } from "@/lib/session";
import { exportarExcel, leerExcel } from "@/lib/excel";

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
  foto_url: "",
};

function badgeEstado(estado: EstadoActivo) {
  if (estado === "Baja") return "destructive";
  if (estado === "Nuevo" || estado === "Bueno") return "success";
  if (estado === "Regular") return "warning";
  return "secondary";
}

const PAGE_SIZE = 25;

function InventarioContenido() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DB | null>(null);
  const [filtroTienda, setFiltroTienda] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  // Prefijado desde el buscador global del topbar (?buscar=...) o editable a mano.
  const [busqueda, setBusqueda] = useState(searchParams.get("buscar") || "");
  const [limite, setLimite] = useState(PAGE_SIZE);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(ACTIVO_VACIO);

  const [transferir, setTransferir] = useState<Activo | null>(null);
  const [nuevaTienda, setNuevaTienda] = useState("");
  const [nuevoSector, setNuevoSector] = useState("");
  const [obsTransferencia, setObsTransferencia] = useState("");

  const [baja, setBaja] = useState<Activo | null>(null);
  const [motivoBaja, setMotivoBaja] = useState("");

  const [qrActivo, setQrActivo] = useState<Activo | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<FilaImportada[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { esAdmin } = useRolActivo();
  const sesion = useSesionDisplay();

  useEffect(() => {
    setData(getDB());
  }, []);

  // Acceso directo desde los accesos rápidos de Inicio (?abrir=nuevo) o el
  // atajo de teclado "N": abre el diálogo de alta apenas carga la página.
  useEffect(() => {
    if (searchParams.get("abrir") === "nuevo" && esAdmin) {
      abrirNuevo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, esAdmin]);

  const activosFiltrados = useMemo(() => {
    if (!data) return [];
    const q = busqueda.trim().toLowerCase();
    return data.activos.filter((a) => {
      if (filtroTienda !== "todas" && a.tienda_id !== filtroTienda) return false;
      if (filtroCategoria !== "todas" && a.categoria_id !== filtroCategoria) return false;
      if (filtroEstado !== "todas" && a.estado !== filtroEstado) return false;
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
  }, [data, filtroTienda, filtroCategoria, filtroEstado, busqueda]);

  useEffect(() => {
    setLimite(PAGE_SIZE);
  }, [filtroTienda, filtroCategoria, filtroEstado, busqueda]);

  if (!data) return null;

  const activosVisibles = activosFiltrados.slice(0, limite);

  const nombreTienda = (id?: string | null) => data.tiendas.find((t) => t.id === id)?.nombre || "-";
  const nombreSector = (id?: string | null) => data.sectores.find((s) => s.id === id)?.nombre || "-";
  const nombreCategoria = (id?: string | null) => data.categorias.find((c) => c.id === id)?.nombre || "-";
  const sectoresDeTienda = (tiendaId: string) => data.sectores.filter((s) => s.tienda_id === tiendaId);

  function abrirNuevo() {
    setEditId(null);
    setForm(ACTIVO_VACIO);
    setOpen(true);
  }

  function abrirEditar(a: Activo) {
    setEditId(a.id);
    setForm({
      codigo_interno: a.codigo_interno,
      nombre: a.nombre,
      descripcion: a.descripcion || "",
      categoria_id: a.categoria_id || "",
      marca: a.marca || "",
      modelo: a.modelo || "",
      numero_serie: a.numero_serie || "",
      estado: a.estado,
      fecha_compra: a.fecha_compra || "",
      proveedor: a.proveedor || "",
      cantidad: (a.cantidad ?? 1).toString(),
      precio_ars: a.precio_ars?.toString() || "",
      precio_usd: a.precio_usd?.toString() || "",
      tienda_id: a.tienda_id || "",
      sector_id: a.sector_id || "",
      responsable: a.responsable || "",
      observaciones: a.observaciones || "",
      foto_url: a.foto_url || "",
    });
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

  function guardar() {
    if (!form.nombre.trim()) {
      toast.error("La descripción del ítem es obligatoria");
      return;
    }
    const db = getDB();

    const codigoFinal = form.codigo_interno.trim() || idGen().toUpperCase();
    const duplicado = db.activos.some(
      (a) => a.id !== editId && a.codigo_interno.trim().toLowerCase() === codigoFinal.toLowerCase()
    );
    if (duplicado) {
      toast.error(`Ya existe un ítem con el código "${codigoFinal}". Usá otro código interno.`);
      return;
    }

    const payload = {
      codigo_interno: codigoFinal,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion,
      categoria_id: form.categoria_id || null,
      marca: form.marca,
      modelo: form.modelo,
      numero_serie: form.numero_serie,
      estado: form.estado,
      fecha_compra: form.fecha_compra,
      proveedor: form.proveedor,
      cantidad: parseInt(form.cantidad) || 1,
      precio_ars: parseFloat(form.precio_ars) || 0,
      precio_usd: parseFloat(form.precio_usd) || 0,
      tienda_id: form.tienda_id || null,
      sector_id: form.sector_id || null,
      responsable: form.responsable,
      observaciones: form.observaciones,
      foto_url: form.foto_url || undefined,
    };

    if (editId) {
      const idx = db.activos.findIndex((a) => a.id === editId);
      if (idx !== -1) {
        const estadoCambio = db.activos[idx].estado !== payload.estado;
        db.activos[idx] = { ...db.activos[idx], ...payload };
        registrarMovimiento(db, {
          activo_id: editId,
          accion: estadoCambio ? "Cambio de estado" : "Modificación",
          observacion: estadoCambio ? `Estado: ${payload.estado}` : "Datos actualizados",
          usuario: sesion.nombre,
        });
      }
      toast.success("Ítem actualizado");
    } else {
      const nuevo: Activo = { id: idGen(), fecha_creacion: now(), ...payload };
      db.activos.push(nuevo);
      registrarMovimiento(db, { activo_id: nuevo.id, accion: "Alta", observacion: "Alta de ítem", usuario: sesion.nombre });
      toast.success("Ítem agregado");
    }

    saveDB(db);
    setData(db);
    setOpen(false);
  }

  function abrirTransferencia(a: Activo) {
    setTransferir(a);
    setNuevaTienda(a.tienda_id || "");
    setNuevoSector(a.sector_id || "");
    setObsTransferencia("");
  }

  function confirmarTransferencia() {
    if (!transferir || !nuevaTienda) {
      toast.error("Selecciona la tienda destino");
      return;
    }
    const db = getDB();
    const idx = db.activos.findIndex((a) => a.id === transferir.id);
    if (idx === -1) return;
    const origenTienda = db.activos[idx].tienda_id;
    const origenSector = db.activos[idx].sector_id;

    db.activos[idx].tienda_id = nuevaTienda;
    db.activos[idx].sector_id = nuevoSector || null;

    registrarMovimiento(db, {
      activo_id: transferir.id,
      accion: origenTienda !== nuevaTienda ? "Transferencia" : "Cambio de sector",
      observacion: obsTransferencia || "Transferencia de ítem",
      tienda_origen_id: origenTienda,
      tienda_destino_id: nuevaTienda,
      sector_origen_id: origenSector,
      sector_destino_id: nuevoSector || null,
      usuario: sesion.nombre,
    });

    saveDB(db);
    setData(db);
    setTransferir(null);
    toast.success("Ítem transferido");
  }

  function abrirBaja(a: Activo) {
    setBaja(a);
    setMotivoBaja("");
  }

  function confirmarBaja() {
    if (!baja || !motivoBaja.trim()) {
      toast.error("Indica el motivo de la baja");
      return;
    }
    const db = getDB();
    const idx = db.activos.findIndex((a) => a.id === baja.id);
    if (idx === -1) return;
    db.activos[idx].estado = "Baja";
    db.activos[idx].fecha_baja = now();
    db.activos[idx].motivo_baja = motivoBaja.trim();

    registrarMovimiento(db, {
      activo_id: baja.id,
      accion: "Baja",
      observacion: motivoBaja.trim(),
      usuario: sesion.nombre,
    });

    saveDB(db);
    setData(db);
    setBaja(null);
    toast.success("Ítem dado de baja");
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
      "Código interno": a.codigo_interno,
      Descripción: a.nombre,
      Categoría: nombreCategoria(a.categoria_id),
      Tienda: nombreTienda(a.tienda_id),
      Sector: nombreSector(a.sector_id),
      Cantidad: a.cantidad ?? 1,
      "Precio unitario ARS": a.precio_ars ?? 0,
      "Precio unitario USD": a.precio_usd ?? 0,
      "Total ARS": valorTotalARS(a),
      "Total USD": valorTotalUSD(a),
      Estado: a.estado,
      Responsable: a.responsable || "",
      Observaciones: a.observaciones || "",
    }));
    exportarExcel(filas, `inventario-${new Date().toISOString().split("T")[0]}`, "Inventario");
    toast.success("Excel generado");
  }

  async function handleImportarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!data) return;
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
          pick(row, ["Código interno", "Codigo interno", "codigo_interno", "Código"]) || idGen().toUpperCase();

        const tiendaTexto = pick(row, ["Tienda"]);
        const tienda = data.tiendas.find((t) => t.nombre.toLowerCase() === tiendaTexto.toLowerCase());
        if (tiendaTexto && !tienda) avisos.push(`Tienda "${tiendaTexto}" no encontrada`);

        const sectorTexto = pick(row, ["Sector"]);
        const sector = tienda
          ? data.sectores.find(
              (s) => s.tienda_id === tienda.id && s.nombre.toLowerCase() === sectorTexto.toLowerCase()
            )
          : undefined;
        if (sectorTexto && tienda && !sector) avisos.push(`Sector "${sectorTexto}" no encontrado en esa tienda`);

        const categoriaTexto = pick(row, ["Categoría", "Categoria"]);
        const categoria = data.categorias.find((c) => c.nombre.toLowerCase() === categoriaTexto.toLowerCase());
        if (categoriaTexto && !categoria) avisos.push(`Categoría "${categoriaTexto}" no encontrada`);

        const estadoTexto = pick(row, ["Estado"]) as EstadoActivo;
        const estado = ESTADOS_ACTIVO.includes(estadoTexto) ? estadoTexto : "Bueno";

        if (codigosVistos.has(codigo.toLowerCase())) {
          avisos.push("Código repetido dentro del mismo archivo (se importa igual, va a pisar la fila anterior)");
        }
        codigosVistos.add(codigo.toLowerCase());

        const yaExiste = data.activos.some((a) => a.codigo_interno.toLowerCase() === codigo.toLowerCase());

        return {
          codigo_interno: codigo,
          nombre: pick(row, ["Descripción", "Descripcion", "Nombre"]),
          categoria_id: categoria?.id || null,
          tienda_id: tienda?.id || null,
          sector_id: sector?.id || null,
          cantidad: parseInt(pick(row, ["Cantidad"])) || 1,
          precio_ars: parseFloat(pick(row, ["Precio unitario ARS", "Precio ARS"])) || 0,
          precio_usd: parseFloat(pick(row, ["Precio unitario USD", "Precio USD"])) || 0,
          estado,
          responsable: pick(row, ["Responsable"]),
          observaciones: pick(row, ["Observaciones"]),
          estadoFila: yaExiste ? "Actualiza existente" : "Nuevo",
          avisos,
        };
      });

      setImportPreview(preview);
      setImportOpen(true);
    } catch (err) {
      toast.error("No se pudo leer el archivo: " + (err as Error).message);
    }
  }

  function confirmarImportacion() {
    const db = getDB();
    let creados = 0;
    let actualizados = 0;

    importPreview.forEach((fila) => {
      if (!fila.nombre) return;
      const idx = db.activos.findIndex((a) => a.codigo_interno.toLowerCase() === fila.codigo_interno.toLowerCase());
      const payload = {
        codigo_interno: fila.codigo_interno,
        nombre: fila.nombre,
        categoria_id: fila.categoria_id,
        tienda_id: fila.tienda_id,
        sector_id: fila.sector_id,
        cantidad: fila.cantidad,
        precio_ars: fila.precio_ars,
        precio_usd: fila.precio_usd,
        estado: fila.estado,
        responsable: fila.responsable,
        observaciones: fila.observaciones,
      };

      if (idx !== -1) {
        db.activos[idx] = { ...db.activos[idx], ...payload };
        registrarMovimiento(db, {
          activo_id: db.activos[idx].id,
          accion: "Modificación",
          observacion: "Actualizado por importación de Excel",
          usuario: sesion.nombre,
        });
        actualizados++;
      } else {
        const nuevo: Activo = { id: idGen(), fecha_creacion: now(), ...payload };
        db.activos.push(nuevo);
        registrarMovimiento(db, {
          activo_id: nuevo.id,
          accion: "Alta",
          observacion: "Alta por importación de Excel",
          usuario: sesion.nombre,
        });
        creados++;
      }
    });

    saveDB(db);
    setData(db);
    setImportOpen(false);
    setImportPreview([]);
    toast.success(`Importación lista: ${creados} nuevos, ${actualizados} actualizados`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Inventario</h3>
        <div className="flex flex-wrap gap-2">
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
          placeholder="Buscar por descripción, código o N° de serie..."
          className="w-full sm:w-64"
        />
        <Select value={filtroTienda} onValueChange={setFiltroTienda}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tienda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las tiendas</SelectItem>
            {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {data.categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los estados</SelectItem>
            {ESTADOS_ACTIVO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tienda / Sector</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>Precio unit.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>QR</TableHead>
                {esAdmin && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No hay ítems registrados
                  </TableCell>
                </TableRow>
              )}
              {activosVisibles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.foto_url} alt={a.nombre} className="h-9 w-9 rounded-md object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>
                    {a.nombre}
                    {a.codigo_interno && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{a.codigo_interno}</span>
                    )}
                  </TableCell>
                  <TableCell>{nombreCategoria(a.categoria_id)}</TableCell>
                  <TableCell>
                    {nombreTienda(a.tienda_id)} <span className="text-muted-foreground">/ {nombreSector(a.sector_id)}</span>
                  </TableCell>
                  <TableCell>{a.cantidad ?? 1}</TableCell>
                  <TableCell className="text-xs">
                    {a.precio_ars ? `$ ${a.precio_ars.toLocaleString("es-AR")}` : ""}
                    {a.precio_ars && a.precio_usd ? " / " : ""}
                    {a.precio_usd ? `US$ ${a.precio_usd.toLocaleString("es-AR")}` : ""}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {a.precio_ars ? `$ ${valorTotalARS(a).toLocaleString("es-AR")}` : ""}
                    {a.precio_ars && a.precio_usd ? " / " : ""}
                    {a.precio_usd ? `US$ ${valorTotalUSD(a).toLocaleString("es-AR")}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeEstado(a.estado)}>{a.estado}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setQrActivo(a)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  {esAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => abrirEditar(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => abrirTransferencia(a)}>
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={a.estado === "Baja"}
                          onClick={() => abrirBaja(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
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
                  {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
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
              <Input type="number" min={1} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div />
            <div>
              <Label>Precio unitario (ARS)</Label>
              <Input type="number" value={form.precio_ars} onChange={(e) => setForm({ ...form, precio_ars: e.target.value })} />
            </div>
            <div>
              <Label>Precio unitario (USD)</Label>
              <Input type="number" value={form.precio_usd} onChange={(e) => setForm({ ...form, precio_usd: e.target.value })} />
            </div>
          </div>

          {/* Detalles adicionales: opcionales, colapsados por defecto */}
          <details className="rounded-md border px-3 py-2" open={!!editId}>
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
              Detalles adicionales (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Código interno</Label>
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
                    {data.categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Label>Número de serie</Label>
                <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
              </div>
              <div>
                <Label>Fecha de compra</Label>
                <Input type="date" value={form.fecha_compra} onChange={(e) => setForm({ ...form, fecha_compra: e.target.value })} />
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
                  Se guarda en este navegador (prototipo). Con Supabase conectado pasaría a Storage.
                </p>
              </div>
            </div>
          </details>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Guardar</Button>
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
                  {data.tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
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
            existente (mismo código interno). Revisá los avisos antes de confirmar.
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
                    <TableCell>{data.tiendas.find((t) => t.id === f.tienda_id)?.nombre || "-"}</TableCell>
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
            <Button onClick={confirmarImportacion}>Confirmar importación</Button>
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

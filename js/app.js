const DB_KEY = 'inventarioApp';

function db() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { tiendas: [], productos: [], movimientos: [], usuarios: [], config: {} };
}

function dbSave(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function idGen() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function now() { return new Date().toISOString(); }

function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg; el.className = 'toast ' + type + ' visible';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function formatDate(iso) {
    return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
    return new Date(iso).toLocaleDateString('es-ES');
}

// ---- Navigation ----
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.dataset.page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');
        document.getElementById('page-title').textContent = this.querySelector('.nav-label').textContent;
        renderPage(page);
    });
});

function renderPage(page) {
    switch(page) {
        case 'inicio': renderInicio(); break;
        case 'dashboard': renderDashboard(); break;
        case 'tiendas': renderTiendas(); break;
        case 'inventario': renderInventario(); break;
        case 'movimientos': renderMovimientos(); break;
        case 'historial': renderHistorial(); break;
        case 'usuarios': renderUsuarios(); break;
        case 'configuracion': renderConfiguracion(); break;
    }
}

// ---- Clock ----
function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleString('es-ES');
}
setInterval(updateClock, 1000);
updateClock();

// ---- INICIO ----
function renderInicio() {
    const data = db();
    document.getElementById('res-tiendas').textContent = data.tiendas.length;
    document.getElementById('res-productos').textContent = data.productos.length;
    document.getElementById('res-movimientos').textContent = data.movimientos.length;
    document.getElementById('res-usuarios').textContent = data.usuarios.length;
}

// ---- DASHBOARD ----
function renderDashboard() {
    const data = db();
    document.getElementById('dash-total-productos').textContent = data.productos.length;
    document.getElementById('dash-tiendas').textContent = data.tiendas.length;

    const hoy = new Date().toISOString().split('T')[0];
    const movHoy = data.movimientos.filter(m => m.fecha.startsWith(hoy));
    document.getElementById('dash-mov-hoy').textContent = movHoy.length;

    const productosConTienda = data.productos.filter(p => p.tienda_id);
    const stockBajo = productosConTienda.filter(p => (p.stock || 0) <= (p.stock_min || 5));
    document.getElementById('dash-stock-bajo').textContent = stockBajo.length;

    const tbodyStock = document.querySelector('#dash-stock-table tbody');
    tbodyStock.innerHTML = stockBajo.slice(0, 10).map(p => {
        const tienda = data.tiendas.find(t => t.id === p.tienda_id);
        return `<tr>
            <td>${p.descripcion}</td>
            <td>${tienda ? tienda.nombre : '-'}</td>
            <td class="badge badge-danger">${p.stock || 0}</td>
            <td>${p.stock_min || 5}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">No hay productos con stock bajo</td></tr>';

    const tbodyMov = document.querySelector('#dash-mov-table tbody');
    const ultimos = data.movimientos.slice(-5).reverse();
    tbodyMov.innerHTML = ultimos.map(m => {
        const prod = data.productos.find(p => p.id === m.producto_id);
        return `<tr>
            <td>${prod ? prod.descripcion : '-'}</td>
            <td><span class="badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}">${m.tipo}</span></td>
            <td>${m.cantidad}</td>
            <td>${formatDate(m.fecha)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">Sin movimientos</td></tr>';
}

// ---- TIENDAS ----
function renderTiendas() {
    const data = db();
    const tbody = document.querySelector('#tiendas-table tbody');
    tbody.innerHTML = data.tiendas.map(t => `<tr>
        <td>${t.id}</td>
        <td>${t.nombre}</td>
        <td>${t.direccion || '-'}</td>
        <td>${t.telefono || '-'}</td>
        <td>
            <button class="btn btn-sm btn-secondary" onclick="editarTienda('${t.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarTienda('${t.id}')">🗑️</button>
        </td>
    </tr>`).join('') || '<tr><td colspan="5">No hay tiendas registradas</td></tr>';
}

function mostrarFormTienda(id) {
    document.getElementById('form-tienda').classList.remove('hidden');
    if (id) {
        const data = db();
        const t = data.tiendas.find(t => t.id === id);
        if (!t) return;
        document.getElementById('form-tienda-title').textContent = 'Editar Tienda';
        document.getElementById('tienda-id').value = t.id;
        document.getElementById('tienda-nombre').value = t.nombre;
        document.getElementById('tienda-direccion').value = t.direccion || '';
        document.getElementById('tienda-telefono').value = t.telefono || '';
    } else {
        document.getElementById('form-tienda-title').textContent = 'Nueva Tienda';
        document.getElementById('tienda-id').value = '';
        document.getElementById('tienda-form').reset();
    }
}

function cerrarForm(id) {
    document.getElementById(id).classList.add('hidden');
}

function guardarTienda(e) {
    e.preventDefault();
    const data = db();
    const id = document.getElementById('tienda-id').value;
    const obj = {
        nombre: document.getElementById('tienda-nombre').value.trim(),
        direccion: document.getElementById('tienda-direccion').value.trim(),
        telefono: document.getElementById('tienda-telefono').value.trim()
    };
    if (id) {
        const idx = data.tiendas.findIndex(t => t.id === id);
        if (idx !== -1) { data.tiendas[idx] = { ...data.tiendas[idx], ...obj }; }
        toast('Tienda actualizada');
    } else {
        obj.id = idGen();
        obj.fecha_creacion = now();
        data.tiendas.push(obj);
        toast('Tienda creada');
    }
    dbSave(data);
    cerrarForm('form-tienda');
    renderTiendas();
}

function editarTienda(id) { mostrarFormTienda(id); }

function eliminarTienda(id) {
    if (!confirm('¿Eliminar esta tienda?')) return;
    const data = db();
    data.tiendas = data.tiendas.filter(t => t.id !== id);
    dbSave(data);
    toast('Tienda eliminada');
    renderTiendas();
}

// ---- INVENTARIO ----
function cargarSelectoresTienda() {
    const data = db();
    const selects = ['filtro-tienda-inv', 'filtro-tienda-hist', 'producto-tienda', 'mov-tienda'];
    selects.forEach(sid => {
        const sel = document.getElementById(sid);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">' + (sid === 'producto-tienda' ? 'Seleccionar tienda' : 'Todas las tiendas') + '</option>';
        data.tiendas.forEach(t => {
            sel.innerHTML += `<option value="${t.id}">${t.nombre}</option>`;
        });
        sel.value = current;
    });
}

function renderInventario() {
    const data = db();
    const filtroTienda = document.getElementById('filtro-tienda-inv').value;

    let productos = data.productos;
    if (filtroTienda) productos = productos.filter(p => p.tienda_id === filtroTienda);

    const tbody = document.querySelector('#inventario-table tbody');
    tbody.innerHTML = productos.map(p => {
        const tienda = data.tiendas.find(t => t.id === p.tienda_id);
        const bajo = (p.stock || 0) <= (p.stock_min || 5);
        return `<tr>
            <td>${p.descripcion}</td>
            <td>${p.sector || '-'}</td>
            <td>${tienda ? tienda.nombre : '-'}</td>
            <td>$${(p.precio_ars || 0).toLocaleString()}</td>
            <td>US$${(p.precio_usd || 0).toLocaleString()}</td>
            <td class="${bajo ? 'badge badge-danger' : ''}">${p.stock || 0}</td>
            <td>${p.stock_min || 5}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editarProducto('${p.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${p.id}')">🗑️</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="8">No hay productos registrados</td></tr>';
}

function mostrarFormProducto(id) {
    cargarSelectoresTienda();
    document.getElementById('form-producto').classList.remove('hidden');
    if (id) {
        const data = db();
        const p = data.productos.find(p => p.id === id);
        if (!p) return;
        document.getElementById('form-producto-title').textContent = 'Editar Producto';
        document.getElementById('producto-id').value = p.id;
        document.getElementById('producto-descripcion').value = p.descripcion;
        document.getElementById('producto-sector').value = p.sector || '';
        document.getElementById('producto-precio-ars').value = p.precio_ars || '';
        document.getElementById('producto-precio-usd').value = p.precio_usd || '';
        document.getElementById('producto-stock-min').value = p.stock_min || 5;
        document.getElementById('producto-tienda').value = p.tienda_id || '';
        document.getElementById('producto-stock').value = p.stock || 0;
    } else {
        document.getElementById('form-producto-title').textContent = 'Nuevo Producto';
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-form').reset();
        document.getElementById('producto-stock-min').value = 5;
    }
}

function guardarProducto(e) {
    e.preventDefault();
    const data = db();
    const id = document.getElementById('producto-id').value;
    const obj = {
        descripcion: document.getElementById('producto-descripcion').value.trim(),
        sector: document.getElementById('producto-sector').value.trim(),
        precio_ars: parseFloat(document.getElementById('producto-precio-ars').value) || 0,
        precio_usd: parseFloat(document.getElementById('producto-precio-usd').value) || 0,
        stock_min: parseInt(document.getElementById('producto-stock-min').value) || 5,
        tienda_id: document.getElementById('producto-tienda').value || null,
        stock: parseInt(document.getElementById('producto-stock').value) || 0
    };
    if (id) {
        const idx = data.productos.findIndex(p => p.id === id);
        if (idx !== -1) { data.productos[idx] = { ...data.productos[idx], ...obj }; }
        toast('Producto actualizado');
    } else {
        obj.id = idGen();
        obj.fecha_creacion = now();
        data.productos.push(obj);
        toast('Producto creado');
    }
    dbSave(data);
    cerrarForm('form-producto');
    renderInventario();
}

function editarProducto(id) { mostrarFormProducto(id); }

function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    const data = db();
    data.productos = data.productos.filter(p => p.id !== id);
    dbSave(data);
    toast('Producto eliminado');
    renderInventario();
}

// ---- MOVIMIENTOS ----
function renderMovimientos() {
    cargarSelectoresTienda();
    cargarProductosTienda();
}

function cargarProductosTienda() {
    const tiendaId = document.getElementById('mov-tienda').value;
    const data = db();
    const sel = document.getElementById('mov-producto');
    sel.innerHTML = '<option value="">Seleccionar producto</option>';
    const productos = tiendaId ? data.productos.filter(p => p.tienda_id === tiendaId) : data.productos;
    productos.forEach(p => {
        sel.innerHTML += `<option value="${p.id}">${p.descripcion} (Stock: ${p.stock || 0})</option>`;
    });
}

function registrarMovimiento(e) {
    e.preventDefault();
    const data = db();
    const mov = {
        id: idGen(),
        tienda_id: document.getElementById('mov-tienda').value,
        producto_id: document.getElementById('mov-producto').value,
        tipo: document.getElementById('mov-tipo').value,
        cantidad: parseInt(document.getElementById('mov-cantidad').value),
        motivo: document.getElementById('mov-motivo').value.trim(),
        fecha: now(),
        usuario: 'Sistema'
    };
    if (!mov.tienda_id || !mov.producto_id) { toast('Selecciona tienda y producto', 'error'); return; }
    if (mov.cantidad < 1) { toast('Cantidad inválida', 'error'); return; }

    const prodIdx = data.productos.findIndex(p => p.id === mov.producto_id);
    if (prodIdx === -1) { toast('Producto no encontrado', 'error'); return; }

    if (mov.tipo === 'salida' && (data.productos[prodIdx].stock || 0) < mov.cantidad) {
        toast('Stock insuficiente', 'error'); return;
    }

    data.productos[prodIdx].stock = (data.productos[prodIdx].stock || 0) + (mov.tipo === 'entrada' ? mov.cantidad : -mov.cantidad);
    data.movimientos.push(mov);
    dbSave(data);
    toast(`Movimiento registrado: ${mov.tipo} de ${mov.cantidad}`);
    document.getElementById('movimiento-form').reset();
    renderMovimientos();
}

// ---- HISTORIAL ----
function renderHistorial() {
    const data = db();
    const filtroTienda = document.getElementById('filtro-tienda-hist').value;
    const filtroTipo = document.getElementById('filtro-tipo-hist').value;
    const filtroFecha = document.getElementById('filtro-fecha-hist').value;

    let movs = [...data.movimientos].reverse();
    if (filtroTienda) movs = movs.filter(m => m.tienda_id === filtroTienda);
    if (filtroTipo) movs = movs.filter(m => m.tipo === filtroTipo);
    if (filtroFecha) movs = movs.filter(m => m.fecha.startsWith(filtroFecha));

    const tbody = document.querySelector('#historial-table tbody');
    tbody.innerHTML = movs.map(m => {
        const tienda = data.tiendas.find(t => t.id === m.tienda_id);
        const prod = data.productos.find(p => p.id === m.producto_id);
        return `<tr>
            <td>${formatDate(m.fecha)}</td>
            <td>${tienda ? tienda.nombre : '-'}</td>
            <td>${prod ? prod.descripcion : '-'}</td>
            <td><span class="badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}">${m.tipo}</span></td>
            <td>${m.cantidad}</td>
            <td>${m.usuario || '-'}</td>
            <td>${m.motivo || '-'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7">No hay movimientos registrados</td></tr>';

    cargarSelectoresTienda();
}

function limpiarFiltrosHistorial() {
    document.getElementById('filtro-tienda-hist').value = '';
    document.getElementById('filtro-tipo-hist').value = '';
    document.getElementById('filtro-fecha-hist').value = '';
    renderHistorial();
}

// ---- USUARIOS ----
function renderUsuarios() {
    const data = db();
    const tbody = document.querySelector('#usuarios-table tbody');
    tbody.innerHTML = data.usuarios.map(u => `<tr>
        <td>${u.id}</td>
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td><span class="badge ${u.rol === 'admin' ? 'badge-info' : 'badge-warning'}">${u.rol}</span></td>
        <td>${u.telefono || '-'}</td>
        <td><span class="badge ${u.activo !== false ? 'badge-success' : 'badge-danger'}">${u.activo !== false ? 'Activo' : 'Inactivo'}</span></td>
        <td>
            <button class="btn btn-sm btn-secondary" onclick="editarUsuario('${u.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${u.id}')">🗑️</button>
        </td>
    </tr>`).join('') || '<tr><td colspan="7">No hay usuarios registrados</td></tr>';
}

function mostrarFormUsuario(id) {
    document.getElementById('form-usuario').classList.remove('hidden');
    if (id) {
        const data = db();
        const u = data.usuarios.find(u => u.id === id);
        if (!u) return;
        document.getElementById('form-usuario-title').textContent = 'Editar Usuario';
        document.getElementById('usuario-id').value = u.id;
        document.getElementById('usuario-nombre').value = u.nombre;
        document.getElementById('usuario-email').value = u.email;
        document.getElementById('usuario-telefono').value = u.telefono || '';
        document.getElementById('usuario-rol').value = u.rol || 'empleado';
    } else {
        document.getElementById('form-usuario-title').textContent = 'Nuevo Usuario';
        document.getElementById('usuario-id').value = '';
        document.getElementById('usuario-form').reset();
    }
}

function guardarUsuario(e) {
    e.preventDefault();
    const data = db();
    const id = document.getElementById('usuario-id').value;
    const obj = {
        nombre: document.getElementById('usuario-nombre').value.trim(),
        email: document.getElementById('usuario-email').value.trim(),
        telefono: document.getElementById('usuario-telefono').value.trim(),
        rol: document.getElementById('usuario-rol').value
    };
    if (id) {
        const idx = data.usuarios.findIndex(u => u.id === id);
        if (idx !== -1) { data.usuarios[idx] = { ...data.usuarios[idx], ...obj }; }
        toast('Usuario actualizado');
    } else {
        obj.id = idGen();
        obj.activo = true;
        obj.fecha_creacion = now();
        data.usuarios.push(obj);
        toast('Usuario creado');
    }
    dbSave(data);
    cerrarForm('form-usuario');
    renderUsuarios();
}

function editarUsuario(id) { mostrarFormUsuario(id); }

function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    const data = db();
    data.usuarios = data.usuarios.filter(u => u.id !== id);
    dbSave(data);
    toast('Usuario eliminado');
    renderUsuarios();
}

// ---- CONFIGURACION ----
function renderConfiguracion() {
    const data = db();
    const cfg = data.config || {};
    document.getElementById('config-nombre').value = cfg.nombre || '';
    document.getElementById('config-stock-min').value = cfg.stock_min || 5;
    document.getElementById('config-moneda').value = cfg.moneda || '$';
}

function guardarConfig(e) {
    e.preventDefault();
    const data = db();
    data.config = {
        nombre: document.getElementById('config-nombre').value.trim(),
        stock_min: parseInt(document.getElementById('config-stock-min').value) || 5,
        moneda: document.getElementById('config-moneda').value
    };
    dbSave(data);
    toast('Configuración guardada');
}

function exportarDatos() {
    const data = db();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inventario-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    toast('Datos exportados');
}

function importarDatos(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.tiendas || !data.productos || !data.movimientos) {
                toast('Formato inválido', 'error'); return;
            }
            dbSave(data);
            toast('Datos importados correctamente');
            renderPage(document.querySelector('.nav-item.active').dataset.page);
        } catch(err) {
            toast('Error al importar: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function limpiarTodosDatos() {
    localStorage.removeItem(DB_KEY);
    toast('Todos los datos eliminados');
    renderPage(document.querySelector('.nav-item.active').dataset.page);
}

// ---- Seed initial data ----
function seedInitialData() {
    const data = db();
    if (data.tiendas.length === 0) {
        data.tiendas.push(
            { id: idGen(), nombre: 'LY25 Alberdi', direccion: '', telefono: '', fecha_creacion: now() }
        );
        dbSave(data);
    }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', function() {
    seedInitialData();
    renderInicio();
});

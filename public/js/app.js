// Sesión
const token = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!token || !usuario) location.href = 'index.html';

function salir() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  location.href = 'index.html';
}

document.getElementById('usuario-actual').textContent = `${usuario.nombre} · ${usuario.rol}`;
document.getElementById('btn-salir').addEventListener('click', salir);
if (usuario.rol === 'ADMIN') document.getElementById('tab-usuarios').hidden = false;

// Utilidades
async function api(ruta, opciones = {}) {
  const res = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return salir();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const soles = (n) => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (f) => new Date(f).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const formData = (form) => Object.fromEntries(new FormData(form).entries());

function toast(mensaje, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = mensaje;
  el.className = `toast ${tipo}`;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

function tabla(id, columnas, filas, vacio = 'Sin registros') {
  const thead = `<thead><tr>${columnas.map((c) => `<th class="${c.clase || ''}">${c.titulo}</th>`).join('')}</tr></thead>`;
  const tbody = filas.length
    ? filas.map((f) => `<tr>${columnas.map((c) => `<td class="${c.clase || ''}">${c.valor(f)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columnas.length}" class="muted center">${vacio}</td></tr>`;
  document.getElementById(id).innerHTML = thead + `<tbody>${tbody}</tbody>`;
}

const badgeStock = (p) =>
  `<span class="badge ${p.stock_bajo ? 'warn' : 'ok'}">${p.stock}</span>`;
const badgeTipo = (t) =>
  `<span class="badge ${t === 'ENTRADA' ? 'in' : 'out'}">${t === 'ENTRADA' ? '▲' : '▼'} ${t}</span>`;

// Pestañas
document.getElementById('tabs').addEventListener('click', (e) => {
  const tab = e.target.dataset.tab;
  if (!tab) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === tab));
  location.hash = tab;
  cargar[tab]?.().catch((err) => toast(err.message, 'error'));
});

// Datos
let productos = [];
let categorias = [];

async function cargarProductos() {
  productos = await api('/productos');
  document.getElementById('total-productos').textContent = productos.length;
  pintarProductos();
  llenarSelectProductos();
}

function pintarProductos() {
  const q = document.getElementById('buscar-producto').value.trim().toLowerCase();
  const filtrados = productos.filter((p) =>
    [p.codigo, p.nombre, p.categoria].some((v) => v.toLowerCase().includes(q)));
  tabla('tabla-productos', [
    { titulo: 'Código', valor: (p) => `<code>${esc(p.codigo)}</code>` },
    { titulo: 'Producto', valor: (p) => `${esc(p.nombre)}<div class="muted small">${esc(p.descripcion)}</div>` },
    { titulo: 'Categoría', valor: (p) => esc(p.categoria) },
    { titulo: 'Precio', clase: 'num', valor: (p) => soles(p.precio) },
    { titulo: 'Stock', clase: 'num', valor: badgeStock },
    { titulo: 'Mín.', clase: 'num', valor: (p) => p.stock_minimo },
  ], filtrados);
}

function llenarSelectProductos() {
  const opciones = productos.map((p) => `<option value="${p.id_producto}">${esc(p.codigo)} · ${esc(p.nombre)}</option>`).join('');
  const select = document.querySelector('#form-movimiento [name=id_producto]');
  const actual = select.value;
  select.innerHTML = opciones;
  if (actual) select.value = actual;
  mostrarStockActual();

  const filtro = document.getElementById('filtro-kardex');
  const f = filtro.value;
  filtro.innerHTML = '<option value="">Todos los productos</option>' + opciones;
  filtro.value = f;
}

function mostrarStockActual() {
  const id = Number(document.querySelector('#form-movimiento [name=id_producto]').value);
  const p = productos.find((x) => x.id_producto === id);
  document.getElementById('stock-actual').innerHTML = p
    ? `Stock actual: <strong>${p.stock}</strong> unidades · mínimo ${p.stock_minimo}`
    : '';
}

async function cargarCategorias() {
  categorias = await api('/categorias');
  document.querySelector('#form-producto [name=id_categoria]').innerHTML =
    categorias.map((c) => `<option value="${c.id_categoria}">${esc(c.nombre)}</option>`).join('');
  tabla('tabla-categorias', [
    { titulo: 'ID', clase: 'num', valor: (c) => c.id_categoria },
    { titulo: 'Nombre', valor: (c) => esc(c.nombre) },
    { titulo: 'Descripción', valor: (c) => esc(c.descripcion) },
    { titulo: 'Productos', clase: 'num', valor: (c) => c.productos },
  ], categorias);
}

async function cargarMovimientos() {
  const id = document.getElementById('filtro-kardex').value;
  const movs = await api(`/movimientos${id ? `?id_producto=${id}` : ''}`);
  tabla('tabla-movimientos', [
    { titulo: '#', clase: 'num', valor: (m) => m.id_movimiento },
    { titulo: 'Fecha', valor: (m) => fecha(m.fecha) },
    { titulo: 'Producto', valor: (m) => `<code>${esc(m.codigo)}</code> ${esc(m.producto)}` },
    { titulo: 'Tipo', valor: (m) => badgeTipo(m.tipo) },
    { titulo: 'Cant.', clase: 'num', valor: (m) => m.cantidad },
    { titulo: 'Stock result.', clase: 'num', valor: (m) => m.stock_resultante ?? '—' },
    { titulo: 'Motivo', valor: (m) => esc(m.motivo) },
    { titulo: 'Usuario', valor: (m) => esc(m.usuario) },
  ], movs);
}

async function cargarResumen() {
  const [r] = await Promise.all([api('/resumen'), productos.length ? null : cargarProductos()]);
  const stats = [
    ['Productos', r.total_productos],
    ['Categorías', r.total_categorias],
    ['Unidades en stock', r.unidades.toLocaleString('es-PE')],
    ['Valor del inventario', soles(r.valor_inventario)],
    ['Con stock bajo', r.stock_bajo, r.stock_bajo ? 'warn' : ''],
    ['Movimientos hoy', r.movimientos_hoy],
  ];
  document.getElementById('stats').innerHTML = stats
    .map(([t, v, c = '']) => `<div class="stat ${c}"><span>${t}</span><strong>${v}</strong></div>`).join('');
  tabla('tabla-stock-bajo', [
    { titulo: 'Código', valor: (p) => `<code>${esc(p.codigo)}</code>` },
    { titulo: 'Producto', valor: (p) => esc(p.nombre) },
    { titulo: 'Categoría', valor: (p) => esc(p.categoria) },
    { titulo: 'Stock', clase: 'num', valor: badgeStock },
    { titulo: 'Mínimo', clase: 'num', valor: (p) => p.stock_minimo },
  ], productos.filter((p) => p.stock_bajo), 'Ningún producto con stock bajo');
}

async function cargarUsuarios() {
  const usuarios = await api('/auth/usuarios');
  tabla('tabla-usuarios', [
    { titulo: 'ID', clase: 'num', valor: (u) => u.id_usuario },
    { titulo: 'Nombre', valor: (u) => esc(u.nombre) },
    { titulo: 'Usuario', valor: (u) => `<code>${esc(u.username)}</code>` },
    { titulo: 'Email', valor: (u) => esc(u.email) },
    { titulo: 'Rol', valor: (u) => `<span class="badge ${u.rol === 'ADMIN' ? 'in' : 'ok'}">${u.rol}</span>` },
  ], usuarios);
}

const cargar = {
  resumen: () => cargarProductos().then(cargarResumen),
  productos: () => Promise.all([cargarProductos(), cargarCategorias()]),
  movimientos: () => cargarProductos().then(cargarMovimientos),
  categorias: cargarCategorias,
  usuarios: cargarUsuarios,
};

// Formularios
document.getElementById('buscar-producto').addEventListener('input', pintarProductos);
document.querySelector('#form-movimiento [name=id_producto]').addEventListener('change', mostrarStockActual);
document.getElementById('filtro-kardex').addEventListener('change', cargarMovimientos);

function onSubmit(id, accion) {
  const form = document.getElementById(id);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true;
    try {
      await accion(formData(form), form);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });
}

onSubmit('form-producto', async (datos, form) => {
  const p = await api('/productos', { method: 'POST', body: JSON.stringify(datos) });
  toast(`Producto ${p.codigo} registrado con stock ${p.stock}`);
  form.reset();
  await cargarProductos();
});

onSubmit('form-movimiento', async (datos, form) => {
  const m = await api('/movimientos', { method: 'POST', body: JSON.stringify(datos) });
  toast(`${m.tipo} de ${m.cantidad} u. registrada · nuevo stock: ${m.stock_resultante}`);
  form.querySelector('[name=cantidad]').value = '';
  form.querySelector('[name=motivo]').value = '';
  await cargarProductos();
  await cargarMovimientos();
});

onSubmit('form-categoria', async (datos, form) => {
  const c = await api('/categorias', { method: 'POST', body: JSON.stringify(datos) });
  toast(`Categoría "${c.nombre}" registrada`);
  form.reset();
  await cargarCategorias();
});

onSubmit('form-usuario', async (datos, form) => {
  const u = await api('/auth/usuarios', { method: 'POST', body: JSON.stringify(datos) });
  toast(`Usuario ${u.username} creado (contraseña guardada como hash)`);
  form.reset();
  await cargarUsuarios();
});

// Inicio
const inicial = location.hash.slice(1);
document.querySelector(`#tabs button[data-tab="${cargar[inicial] ? inicial : 'resumen'}"]`).click();
cargarCategorias();

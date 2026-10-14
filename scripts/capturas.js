// Genera las capturas de evidencia en docs/img usando Chrome/Edge instalado.
// Requiere el servidor corriendo (npm start).  Uso:  npm run capturas
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { pool, esLocal } = require('../src/db');

const BASE = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.join(__dirname, '..', 'docs', 'img');
const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
// Usuario de prueba definido en database/02_datos_prueba.sql
const ADMIN = { usuario: 'admin', clave: 'Admin2026!' };

const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function tablaHtml(titulo, sql, rows) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return `<section><h2>${titulo}</h2><pre>${esc(sql)}</pre>
    <table><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] instanceof Date ? r[c].toISOString() : r[c])}</td>`).join('')}</tr>`).join('')}
    </table><p>(${rows.length} filas)</p></section>`;
}

async function evidenciaBD(page) {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const consultas = [
    ['Servidor de base de datos', `SELECT current_database() AS base_datos, inet_server_addr() AS ip_servidor, split_part(version(), ' on ', 1) AS version, to_char(NOW(), 'DD/MM/YYYY HH24:MI:SS') || ' (America/Lima)' AS fecha_hora`],
    ['Registros por tabla', `SELECT 'usuarios' AS tabla, COUNT(*) AS registros FROM usuarios UNION ALL SELECT 'categorias', COUNT(*) FROM categorias UNION ALL SELECT 'productos', COUNT(*) FROM productos UNION ALL SELECT 'movimientos', COUNT(*) FROM movimientos`],
    ['Contraseñas almacenadas con hash bcrypt', `SELECT id_usuario, username, rol, password_hash FROM usuarios ORDER BY id_usuario`],
    ['Productos cargados (stock calculado por el trigger)', `SELECT codigo, nombre, categoria, precio, stock, stock_minimo, stock_bajo FROM vw_stock_productos ORDER BY codigo`],
  ];
  let html = '';
  for (const [titulo, sql] of consultas) {
    const { rows } = await pool.query(sql);
    html += tablaHtml(titulo, sql, rows);
  }
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{font:13px Consolas,monospace;margin:24px;color:#1c2333;background:#fff}
    h1{font:600 20px Segoe UI,sans-serif} h2{font:600 15px Segoe UI,sans-serif;margin:24px 0 6px}
    pre{background:#1e1e2e;color:#cdd6f4;padding:10px;border-radius:6px;white-space:pre-wrap}
    table{border-collapse:collapse}th,td{border:1px solid #cfd5e3;padding:4px 8px;text-align:left}
    th{background:#eef1f8}</style>
    <h1>Consultas ejecutadas sobre la base de datos ${esLocal ? 'LOCAL' : 'en RAILWAY'} (host: ${esc(host)})</h1>${html}`);
  await page.screenshot({ path: path.join(OUT, '02-evidencia-bd.png'), fullPage: true });
}

async function diagramaER(page) {
  const mmd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'modelo-er.mmd'), 'utf8');
  await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <body style="margin:0;background:#fff">
    <div id="er" style="display:inline-block;padding:16px;background:#fff">
    <pre class="mermaid" style="margin:0">${esc(mmd)}</pre></div>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({ startOnLoad: true, theme: 'default', er: { fontSize: 14, useMaxWidth: false } });</script></body>`,
    { waitUntil: 'networkidle0' });
  await page.waitForSelector('pre.mermaid svg');
  await (await page.$('#er')).screenshot({ path: path.join(OUT, '01-modelo-er.png') });
  await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 1 });
}

async function captura(page, nombre) {
  await pausa(250);
  await page.screenshot({ path: path.join(OUT, nombre) });
  console.log('  -', nombre);
}

async function esperarToast(page, texto) {
  await page.waitForFunction(
    (t) => { const el = document.getElementById('toast'); return !el.hidden && el.textContent.includes(t); },
    { timeout: 10000 }, texto);
}

async function esperarKardex(page, motivo) {
  await page.waitForFunction(
    (m) => document.querySelector('#tabla-movimientos tbody tr')?.textContent.includes(m),
    { timeout: 10000 }, motivo);
}

async function abrirPestana(page, tab, selectorListo) {
  await page.evaluate(() => { document.getElementById('toast').hidden = true; });
  await page.click(`#tabs button[data-tab="${tab}"]`);
  await page.waitForSelector(selectorListo);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const executablePath = NAVEGADORES.find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 1366, height: 800 } });
  const page = await browser.newPage();

  console.log('Diagrama ER y evidencia de la BD…');
  await diagramaER(page);
  await evidenciaBD(page);

  console.log('Capturas de la aplicación en', BASE);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('estado-bd').textContent.includes('Verificando'));
  await captura(page, '03-login.png');

  await page.type('#username', ADMIN.usuario);
  await page.type('#password', 'clave-incorrecta');
  await page.click('button[type=submit]');
  await page.waitForSelector('#login-error:not([hidden])');
  await captura(page, '04-login-error.png');

  await page.$eval('#password', (el) => (el.value = ''));
  await page.type('#password', ADMIN.clave);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')]);
  await page.waitForSelector('#stats .stat');
  await captura(page, '05-resumen.png');

  await abrirPestana(page, 'productos', '#tabla-productos tbody tr');
  await captura(page, '06-productos.png');

  // Registro de un producto nuevo con stock inicial
  const codigo = `LAP-${String(Date.now()).slice(-3)}`;
  await page.type('#form-producto [name=codigo]', codigo);
  await page.select('#form-producto [name=id_categoria]', '1');
  await page.type('#form-producto [name=nombre]', 'Laptop Acer Aspire 5');
  await page.type('#form-producto [name=descripcion]', 'Core i5, 8 GB RAM, 512 GB SSD');
  await page.type('#form-producto [name=precio]', '2299.90');
  await page.$eval('#form-producto [name=stock_inicial]', (el) => (el.value = '6'));
  await page.$eval('#form-producto [name=stock_minimo]', (el) => (el.value = '2'));
  await captura(page, '07-producto-formulario.png');
  await page.click('#form-producto button[type=submit]');
  await esperarToast(page, codigo);
  await page.type('#buscar-producto', codigo);
  await captura(page, '08-producto-registrado.png');

  // Entrada de mercadería
  await abrirPestana(page, 'movimientos', '#tabla-movimientos tbody tr');
  const idProducto = await page.$eval('#form-movimiento [name=id_producto]', (sel, cod) =>
    [...sel.options].find((o) => o.textContent.startsWith(cod)).value, codigo);
  await page.select('#form-movimiento [name=id_producto]', idProducto);
  await page.click('#form-movimiento input[value=ENTRADA] + span');
  await page.type('#form-movimiento [name=cantidad]', '10');
  await page.type('#form-movimiento [name=motivo]', 'Compra a proveedor OC-0101');
  await captura(page, '09-entrada-formulario.png');
  await page.click('#form-movimiento button[type=submit]');
  await esperarToast(page, 'nuevo stock: 16');
  await esperarKardex(page, 'OC-0101');
  await captura(page, '10-entrada-registrada.png');

  // Salida de mercadería
  await page.click('#form-movimiento input[value=SALIDA] + span');
  await page.type('#form-movimiento [name=cantidad]', '4');
  await page.type('#form-movimiento [name=motivo]', 'Venta boleta B001-0150');
  await page.click('#form-movimiento button[type=submit]');
  await esperarToast(page, 'nuevo stock: 12');
  await esperarKardex(page, 'B001-0150');
  await captura(page, '11-salida-registrada.png');

  // Salida mayor al stock: el trigger la rechaza
  await page.type('#form-movimiento [name=cantidad]', '500');
  await page.type('#form-movimiento [name=motivo]', 'Prueba de validación');
  await page.click('#form-movimiento button[type=submit]');
  await esperarToast(page, 'Stock insuficiente');
  await captura(page, '12-salida-sin-stock.png');

  await abrirPestana(page, 'categorias', '#tabla-categorias tbody tr');
  await captura(page, '13-categorias.png');

  await abrirPestana(page, 'usuarios', '#tabla-usuarios tbody tr');
  await captura(page, '14-usuarios.png');

  await browser.close();
  await pool.end();
  console.log('Listo: capturas en docs/img');
}

main().catch(async (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

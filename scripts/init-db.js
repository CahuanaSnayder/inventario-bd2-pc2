// Crea la base de datos (si es local y no existe), ejecuta el esquema y
// carga los datos de prueba. Uso:  npm run db:init
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const url = new URL(process.env.DATABASE_URL);
const esLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
const ssl = esLocal ? false : { rejectUnauthorized: false };
const leer = (archivo) => fs.readFileSync(path.join(__dirname, '..', 'database', archivo), 'utf8');

async function crearBaseSiNoExiste() {
  const nombreBD = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString(), ssl });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBD]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${nombreBD}"`);
    console.log(`Base de datos "${nombreBD}" creada`);
  }
  await client.end();
}

async function main() {
  if (esLocal) await crearBaseSiNoExiste();

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  await client.connect();
  console.log(`Conectado a ${url.hostname}:${url.port}${url.pathname} (${esLocal ? 'local' : 'nube'})`);

  await client.query(leer('01_esquema.sql'));
  console.log('OK 01_esquema.sql ejecutado (tablas, FKs, trigger y vistas)');
  await client.query(leer('02_datos_prueba.sql'));
  console.log('OK 02_datos_prueba.sql ejecutado (usuarios, categorías, productos, movimientos)');

  const conteo = await client.query(`
    SELECT 'usuarios' AS tabla, COUNT(*)::int AS registros FROM usuarios
    UNION ALL SELECT 'categorias',  COUNT(*)::int FROM categorias
    UNION ALL SELECT 'productos',   COUNT(*)::int FROM productos
    UNION ALL SELECT 'movimientos', COUNT(*)::int FROM movimientos`);
  console.table(conteo.rows);

  const usuarios = await client.query(
    `SELECT username, rol, LEFT(password_hash, 29) || '...' AS password_hash FROM usuarios`);
  console.log('Contraseñas guardadas como hash bcrypt:');
  console.table(usuarios.rows);

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

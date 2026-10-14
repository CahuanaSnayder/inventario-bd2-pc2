const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta la variable DATABASE_URL (revisa el archivo .env)');
}

// En local no se usa SSL; en la nube (Railway) la conexión va cifrada.
const host = new URL(connectionString).hostname;
const esLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

const pool = new Pool({
  connectionString,
  ssl: esLocal ? false : { rejectUnauthorized: false },
  options: '-c timezone=America/Lima', // fechas y CURRENT_DATE en hora de Perú
});

module.exports = { pool, esLocal };

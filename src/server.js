require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const { pool, esLocal } = require('./db');

if (!process.env.JWT_SECRET) {
  throw new Error('Falta la variable JWT_SECRET (revisa el archivo .env)');
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/salud', async (_req, res) => {
  const { rows } = await pool.query('SELECT NOW() AS hora, current_database() AS bd');
  res.json({ ok: true, bd: rows[0].bd, hora: rows[0].hora, entorno: esLocal ? 'local' : 'nube' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/inventario'));

// Traduce los errores de PostgreSQL a mensajes claros para el usuario
app.use((err, _req, res, _next) => {
  const mensajes = {
    '23505': 'Ya existe un registro con ese valor (código, usuario o email duplicado)',
    '23503': 'La categoría o el producto indicado no existe',
    '23514': err.message.startsWith('Stock insuficiente') ? err.message : 'Un valor no cumple las reglas (precio/stock no pueden ser negativos)',
    '22P02': 'Formato de dato inválido',
  };
  const mensaje = mensajes[err.code];
  if (mensaje) return res.status(400).json({ error: mensaje });

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}  (BD ${esLocal ? 'local' : 'en la nube'})`);
});

const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------- Resumen
router.get('/resumen', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT (SELECT COUNT(*) FROM productos)::int                          AS total_productos,
           (SELECT COUNT(*) FROM categorias)::int                         AS total_categorias,
           (SELECT COALESCE(SUM(stock), 0) FROM productos)::int           AS unidades,
           (SELECT COALESCE(SUM(precio * stock), 0) FROM productos)       AS valor_inventario,
           (SELECT COUNT(*) FROM productos WHERE stock <= stock_minimo)::int AS stock_bajo,
           (SELECT COUNT(*) FROM movimientos WHERE fecha::date = CURRENT_DATE)::int AS movimientos_hoy
  `);
  res.json(rows[0]);
});

// ------------------------------------------------------------- Categorías
router.get('/categorias', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id_categoria, c.nombre, c.descripcion, COUNT(p.id_producto)::int AS productos
      FROM categorias c LEFT JOIN productos p ON p.id_categoria = c.id_categoria
     GROUP BY c.id_categoria ORDER BY c.nombre`);
  res.json(rows);
});

router.post('/categorias', async (req, res) => {
  const { nombre, descripcion } = req.body || {};
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const { rows } = await pool.query(
    'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
    [nombre.trim(), descripcion?.trim() || null]
  );
  res.status(201).json(rows[0]);
});

// -------------------------------------------------------------- Productos
router.get('/productos', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.id_categoria,
           c.nombre AS categoria, p.precio, p.stock, p.stock_minimo,
           (p.stock <= p.stock_minimo) AS stock_bajo
      FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria
     ORDER BY p.codigo`);
  res.json(rows);
});

// Registra un producto. Si trae stock inicial, se registra como ENTRADA
// en la misma transacción y el trigger calcula el stock.
router.post('/productos', async (req, res) => {
  const { codigo, nombre, descripcion, id_categoria, precio, stock_minimo = 5, stock_inicial = 0 } = req.body || {};
  if (!codigo?.trim() || !nombre?.trim() || !id_categoria || precio === undefined || precio === '') {
    return res.status(400).json({ error: 'Código, nombre, categoría y precio son obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO productos (codigo, nombre, descripcion, id_categoria, precio, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_producto`,
      [codigo.trim().toUpperCase(), nombre.trim(), descripcion?.trim() || null, id_categoria, precio, stock_minimo]
    );
    const idProducto = rows[0].id_producto;

    if (Number(stock_inicial) > 0) {
      await client.query(
        `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, motivo)
         VALUES ($1, $2, 'ENTRADA', $3, 'Stock inicial')`,
        [idProducto, req.user.id, stock_inicial]
      );
    }
    await client.query('COMMIT');

    const creado = await pool.query('SELECT * FROM productos WHERE id_producto = $1', [idProducto]);
    res.status(201).json(creado.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Edita datos del producto (el stock NO se edita aquí: solo vía movimientos)
router.put('/productos/:id', async (req, res) => {
  const { nombre, descripcion, id_categoria, precio, stock_minimo } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE productos
        SET nombre = $1, descripcion = $2, id_categoria = $3, precio = $4, stock_minimo = $5
      WHERE id_producto = $6 RETURNING *`,
    [nombre, descripcion || null, id_categoria, precio, stock_minimo, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

// ------------------------------------------------------------ Movimientos
router.get('/movimientos', async (req, res) => {
  const params = [];
  let filtro = '';
  if (req.query.id_producto) {
    params.push(req.query.id_producto);
    filtro = 'WHERE m.id_producto = $1';
  }
  const { rows } = await pool.query(`
    SELECT m.id_movimiento, m.fecha, m.tipo, m.cantidad, m.stock_resultante, m.motivo,
           p.codigo, p.nombre AS producto, u.username AS usuario
      FROM movimientos m
      JOIN productos p ON p.id_producto = m.id_producto
      JOIN usuarios  u ON u.id_usuario  = m.id_usuario
      ${filtro}
     ORDER BY m.id_movimiento DESC
     LIMIT 200`, params);
  res.json(rows);
});

// Registra una ENTRADA o SALIDA. El trigger trg_movimientos_stock
// actualiza productos.stock y rechaza salidas sin stock suficiente.
router.post('/movimientos', async (req, res) => {
  const { id_producto, tipo, cantidad, motivo } = req.body || {};
  if (!id_producto || !['ENTRADA', 'SALIDA'].includes(tipo) || !(Number(cantidad) > 0)) {
    return res.status(400).json({ error: 'Producto, tipo (ENTRADA/SALIDA) y cantidad > 0 son obligatorios' });
  }

  const { rows } = await pool.query(
    `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, motivo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_movimiento, tipo, cantidad, stock_resultante, fecha`,
    [id_producto, req.user.id, tipo, cantidad, motivo?.trim() || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

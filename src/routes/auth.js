const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

// POST /api/auth/login  -> valida usuario y contraseña contra la BD
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const { rows } = await pool.query(
    `SELECT id_usuario, nombre, username, password_hash, rol, activo
       FROM usuarios WHERE username = $1`,
    [username.trim()]
  );
  const usuario = rows[0];

  // bcrypt.compare vuelve a hashear la clave ingresada y la compara con el hash
  const valido = usuario && usuario.activo && (await bcrypt.compare(password, usuario.password_hash));
  if (!valido) {
    // Mismo mensaje para usuario o clave incorrecta (no revela cuál falló)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const payload = { id: usuario.id_usuario, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: payload });
});

// GET /api/auth/me -> datos del usuario autenticado
router.get('/me', requireAuth, (req, res) => res.json({ usuario: req.user }));

// GET /api/auth/usuarios -> lista de usuarios (solo admin, sin hashes)
router.get('/usuarios', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id_usuario, nombre, username, email, rol, activo, creado_en
       FROM usuarios ORDER BY id_usuario`
  );
  res.json(rows);
});

// POST /api/auth/usuarios -> registra un usuario guardando SOLO el hash bcrypt
router.post('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, username, email, password, rol = 'OPERADOR' } = req.body || {};
  if (!nombre || !username || !email || !password) {
    return res.status(400).json({ error: 'Nombre, usuario, email y contraseña son obligatorios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, username, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_usuario, nombre, username, email, rol, activo, creado_en`,
    [nombre.trim(), username.trim(), email.trim(), passwordHash, rol]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

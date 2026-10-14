const jwt = require('jsonwebtoken');

// Verifica el token JWT enviado en la cabecera Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo un administrador puede realizar esta acción' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };

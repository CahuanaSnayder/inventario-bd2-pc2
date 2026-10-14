-- Consultas para revisar los datos cargados

-- 1) Conteo de registros por tabla (mínimo 20 productos)
SELECT 'usuarios' AS tabla, COUNT(*) FROM usuarios
UNION ALL SELECT 'categorias',  COUNT(*) FROM categorias
UNION ALL SELECT 'productos',   COUNT(*) FROM productos
UNION ALL SELECT 'movimientos', COUNT(*) FROM movimientos;

-- 2) Contraseñas almacenadas como hash (no texto plano)
SELECT id_usuario, username, rol, LEFT(password_hash, 29) || '...' AS password_hash
  FROM usuarios;

-- 3) Validar una contraseña en SQL (lo mismo que hace el backend con bcrypt)
SELECT username, (password_hash = crypt('Admin2026!', password_hash)) AS clave_correcta
  FROM usuarios WHERE username = 'admin';

-- 4) Stock actual por producto
SELECT codigo, nombre, categoria, precio, stock, stock_minimo, stock_bajo
  FROM vw_stock_productos ORDER BY codigo;

-- 5) Kardex (últimos movimientos)
SELECT * FROM vw_kardex ORDER BY id_movimiento DESC LIMIT 15;

-- 6) Prueba del trigger: una salida mayor al stock debe fallar
-- INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, motivo)
-- VALUES (1, 1, 'SALIDA', 9999, 'Prueba de validación');

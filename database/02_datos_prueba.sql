-- Datos de prueba: usuarios, categorias, 25 productos y algunos movimientos

-- Las claves se guardan como hash bcrypt con crypt() de pgcrypto
INSERT INTO usuarios (nombre, username, email, password_hash, rol) VALUES
('Administrador del Sistema', 'admin',    'admin@inventario.pe',    crypt('Admin2026!',    gen_salt('bf', 10)), 'ADMIN'),
('Operador de Almacén',       'operador', 'operador@inventario.pe', crypt('Operador2026!', gen_salt('bf', 10)), 'OPERADOR');

INSERT INTO categorias (nombre, descripcion) VALUES
('Laptops',        'Computadoras portátiles'),
('Periféricos',    'Teclados, mouse, audífonos y webcams'),
('Monitores',      'Pantallas y monitores'),
('Almacenamiento', 'Discos SSD, HDD y memorias USB'),
('Redes',          'Routers, switches y cables de red'),
('Componentes',    'Memorias RAM, procesadores y fuentes');

-- El stock empieza en 0, se carga despues con movimientos de entrada
INSERT INTO productos (codigo, nombre, descripcion, id_categoria, precio, stock_minimo) VALUES
('LAP-001', 'Laptop Lenovo IdeaPad 5',      'Ryzen 7, 16 GB RAM, 512 GB SSD',  1, 2899.00, 3),
('LAP-002', 'Laptop HP Pavilion 15',        'Core i5, 8 GB RAM, 512 GB SSD',   1, 2499.00, 3),
('LAP-003', 'Laptop ASUS VivoBook 14',      'Core i3, 8 GB RAM, 256 GB SSD',   1, 1799.00, 3),
('LAP-004', 'Laptop Dell Inspiron 3520',    'Core i7, 16 GB RAM, 1 TB SSD',    1, 3599.00, 2),
('PER-001', 'Mouse Logitech M170',          'Inalámbrico 2.4 GHz',             2,   39.90, 10),
('PER-002', 'Teclado Logitech K120',        'USB, español',                    2,   49.90, 10),
('PER-003', 'Audífonos HyperX Cloud II',    'Gaming 7.1',                      2,  349.00, 5),
('PER-004', 'Webcam Logitech C920',         'Full HD 1080p',                   2,  299.00, 5),
('PER-005', 'Mouse Pad Redragon XL',        '80 x 30 cm',                      2,   45.00, 8),
('MON-001', 'Monitor LG 24" IPS',           '1920x1080, 75 Hz',                3,  549.00, 4),
('MON-002', 'Monitor Samsung 27" Curvo',    '1920x1080, 75 Hz',                3,  799.00, 3),
('MON-003', 'Monitor AOC 24G2 144 Hz',      'Gaming, IPS',                     3,  899.00, 3),
('ALM-001', 'SSD Kingston NV2 1 TB',        'NVMe M.2',                        4,  259.00, 6),
('ALM-002', 'SSD Samsung 870 EVO 500 GB',   'SATA 2.5"',                       4,  239.00, 6),
('ALM-003', 'Disco Externo Seagate 2 TB',   'USB 3.0',                         4,  329.00, 4),
('ALM-004', 'USB SanDisk 64 GB',            'USB 3.1',                         4,   35.00, 15),
('RED-001', 'Router TP-Link Archer C6',     'AC1200 doble banda',              5,  189.00, 4),
('RED-002', 'Switch TP-Link 8 puertos',     'Gigabit no administrable',        5,  119.00, 4),
('RED-003', 'Cable UTP Cat6 3 m',           'Patch cord',                      5,   12.00, 20),
('RED-004', 'Adaptador WiFi USB TP-Link',   'AC600',                           5,   79.00, 5),
('COM-001', 'Memoria RAM Kingston 8 GB',    'DDR4 3200 MHz',                   6,  119.00, 8),
('COM-002', 'Memoria RAM Corsair 16 GB',    'DDR4 3200 MHz',                   6,  229.00, 6),
('COM-003', 'Procesador AMD Ryzen 5 5600',  '6 núcleos, AM4',                  6,  599.00, 3),
('COM-004', 'Fuente EVGA 600 W 80+',        'Certificación 80 Plus',           6,  259.00, 3),
('COM-005', 'Pasta Térmica Arctic MX-4',    '4 gramos',                        6,   29.90, 10);

-- Stock inicial (el trigger actualiza productos.stock)
INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, motivo)
SELECT p.id_producto, 1, 'ENTRADA', s.cantidad, 'Stock inicial'
  FROM productos p
  JOIN (VALUES
        ('LAP-001', 10), ('LAP-002', 12), ('LAP-003', 8),  ('LAP-004', 5),
        ('PER-001', 60), ('PER-002', 45), ('PER-003', 15), ('PER-004', 12),
        ('PER-005', 30), ('MON-001', 14), ('MON-002', 9),  ('MON-003', 7),
        ('ALM-001', 25), ('ALM-002', 20), ('ALM-003', 10), ('ALM-004', 80),
        ('RED-001', 15), ('RED-002', 12), ('RED-003', 150),('RED-004', 18),
        ('COM-001', 30), ('COM-002', 20), ('COM-003', 6),  ('COM-004', 8),
        ('COM-005', 40)
       ) AS s(codigo, cantidad) ON s.codigo = p.codigo
 ORDER BY p.id_producto;

-- Algunas ventas y compras de ejemplo
INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, motivo)
SELECT p.id_producto, 2, s.tipo, s.cantidad, s.motivo
  FROM productos p
  JOIN (VALUES
        ('LAP-001', 'SALIDA',  3, 'Venta boleta B001-0001'),
        ('PER-001', 'SALIDA', 15, 'Venta factura F001-0010'),
        ('MON-001', 'SALIDA',  4, 'Venta boleta B001-0002'),
        ('ALM-004', 'SALIDA', 20, 'Venta corporativa'),
        ('COM-003', 'SALIDA',  4, 'Venta boleta B001-0003'),
        ('PER-001', 'ENTRADA', 25, 'Compra a proveedor OC-0045'),
        ('RED-003', 'SALIDA', 40, 'Instalación de laboratorio')
       ) AS s(codigo, tipo, cantidad, motivo) ON s.codigo = p.codigo;

-- Practica Calificada 2 - Base de Datos II
-- Sistema de inventario en PostgreSQL

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- para crypt() y gen_salt()

-- Si ya existen, se borran para poder volver a ejecutar el script
DROP VIEW IF EXISTS vw_kardex;
DROP VIEW IF EXISTS vw_stock_productos;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_stock();


CREATE TABLE usuarios (
    id_usuario     SERIAL PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    email          VARCHAR(120) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,      -- se guarda el hash, no la clave
    rol            VARCHAR(20)  NOT NULL DEFAULT 'OPERADOR' CHECK (rol IN ('ADMIN', 'OPERADOR')),
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE categorias (
    id_categoria   SERIAL PRIMARY KEY,
    nombre         VARCHAR(80) NOT NULL UNIQUE,
    descripcion    VARCHAR(255)
);

CREATE TABLE productos (
    id_producto    SERIAL PRIMARY KEY,
    codigo         VARCHAR(20)   NOT NULL UNIQUE,
    nombre         VARCHAR(120)  NOT NULL,
    descripcion    VARCHAR(255),
    id_categoria   INT           NOT NULL,
    precio         NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock          INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo   INT           NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (id_categoria)
        REFERENCES categorias (id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Entradas y salidas de cada producto (kardex)
CREATE TABLE movimientos (
    id_movimiento    SERIAL PRIMARY KEY,
    id_producto      INT          NOT NULL,
    id_usuario       INT          NOT NULL,
    tipo             VARCHAR(10)  NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    cantidad         INT          NOT NULL CHECK (cantidad > 0),
    stock_resultante INT,
    motivo           VARCHAR(255),
    fecha            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_movimientos_producto FOREIGN KEY (id_producto)
        REFERENCES productos (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_movimientos_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_productos_categoria  ON productos (id_categoria);
CREATE INDEX idx_movimientos_producto ON movimientos (id_producto);
CREATE INDEX idx_movimientos_usuario  ON movimientos (id_usuario);
CREATE INDEX idx_movimientos_fecha    ON movimientos (fecha DESC);


-- Trigger: cada vez que se inserta un movimiento se actualiza el stock.
-- Si es una salida y no alcanza el stock, se cancela la operacion.
CREATE OR REPLACE FUNCTION fn_actualizar_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_stock INT;
BEGIN
    SELECT stock INTO v_stock
      FROM productos
     WHERE id_producto = NEW.id_producto
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe', NEW.id_producto;
    END IF;

    IF NEW.tipo = 'ENTRADA' THEN
        v_stock := v_stock + NEW.cantidad;
    ELSE
        IF v_stock < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente: disponible %, solicitado %', v_stock, NEW.cantidad
                USING ERRCODE = 'check_violation';
        END IF;
        v_stock := v_stock - NEW.cantidad;
    END IF;

    UPDATE productos SET stock = v_stock WHERE id_producto = NEW.id_producto;
    NEW.stock_resultante := v_stock;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimientos_stock
    BEFORE INSERT ON movimientos
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_stock();


-- Vistas para los reportes
CREATE VIEW vw_stock_productos AS
SELECT p.id_producto, p.codigo, p.nombre, c.nombre AS categoria,
       p.precio, p.stock, p.stock_minimo,
       (p.stock <= p.stock_minimo) AS stock_bajo,
       (p.precio * p.stock) AS valor_inventario
  FROM productos p
  JOIN categorias c ON c.id_categoria = p.id_categoria;

CREATE VIEW vw_kardex AS
SELECT m.id_movimiento, m.fecha, p.codigo, p.nombre AS producto,
       m.tipo, m.cantidad, m.stock_resultante, m.motivo, u.username AS usuario
  FROM movimientos m
  JOIN productos p ON p.id_producto = m.id_producto
  JOIN usuarios u ON u.id_usuario = m.id_usuario;

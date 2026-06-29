-- ============================================================
-- NEGOCIO SAAS - SCHEMA COMPLETO v1.0
-- Arquitectura Multi-Tenant con Row Level Security (RLS)
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE estado_empresa AS ENUM ('prueba', 'activa', 'suspendida', 'vencida');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'preparando', 'en_camino', 'entregado', 'cancelado');
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'otro');
CREATE TYPE rol_usuario AS ENUM ('super_admin', 'admin_empresa', 'empleado');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste');
CREATE TYPE periodo_suscripcion AS ENUM ('mensual', 'trimestral', 'semestral', 'anual');
CREATE TYPE estado_licencia AS ENUM ('prueba', 'activa', 'suspendida', 'vencida', 'renovada');

-- ============================================================
-- 1. PLANES
-- ============================================================

CREATE TABLE planes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  descripcion     TEXT,
  precio_mensual  DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_anual    DECIMAL(10,2),
  max_usuarios    INTEGER NOT NULL DEFAULT 1,
  max_productos   INTEGER NOT NULL DEFAULT 50,
  max_clientes    INTEGER NOT NULL DEFAULT 100,
  max_pedidos_mes INTEGER NOT NULL DEFAULT 100,
  max_sucursales  INTEGER NOT NULL DEFAULT 1,
  tiene_reportes  BOOLEAN DEFAULT FALSE,
  tiene_dashboard BOOLEAN DEFAULT TRUE,
  tiene_inventario BOOLEAN DEFAULT FALSE,
  tiene_api       BOOLEAN DEFAULT FALSE,
  es_activo       BOOLEAN DEFAULT TRUE,
  orden           INTEGER DEFAULT 0,
  color           VARCHAR(20) DEFAULT '#378ADD',
  icono           VARCHAR(50) DEFAULT 'sparkles',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. EMPRESAS (Tenant raíz)
-- ============================================================

CREATE TABLE empresas (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre          VARCHAR(200) NOT NULL,
  slug            VARCHAR(100) UNIQUE,
  ruc             VARCHAR(20),
  direccion       TEXT,
  telefono        VARCHAR(30),
  whatsapp        VARCHAR(30),
  email           VARCHAR(200),
  logo_url        TEXT,
  moneda          VARCHAR(10) DEFAULT 'PEN',
  simbolo_moneda  VARCHAR(5)  DEFAULT 'S/',
  impuesto_pct    DECIMAL(5,2) DEFAULT 0,
  tipo_negocio    VARCHAR(100),
  plan_id         UUID REFERENCES planes(id),
  estado          estado_empresa DEFAULT 'prueba',
  fecha_inicio    DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  tema            VARCHAR(20) DEFAULT 'light',
  configuracion   JSONB DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_empresas_plan   ON empresas(plan_id);
CREATE INDEX idx_empresas_estado ON empresas(estado);
CREATE INDEX idx_empresas_slug   ON empresas(slug);

-- ============================================================
-- 3. USUARIOS
-- ============================================================

CREATE TABLE usuarios (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id      UUID REFERENCES empresas(id) ON DELETE SET NULL,
  nombre          VARCHAR(200) NOT NULL,
  email           VARCHAR(200) NOT NULL,
  telefono        VARCHAR(30),
  rol             rol_usuario DEFAULT 'empleado',
  permisos        JSONB DEFAULT '{}',
  avatar_url      TEXT,
  es_activo       BOOLEAN DEFAULT TRUE,
  ultimo_acceso   TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_auth    ON usuarios(auth_user_id);
CREATE INDEX idx_usuarios_rol     ON usuarios(rol);

-- ============================================================
-- 4. LICENCIAS
-- ============================================================

CREATE TABLE licencias (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES planes(id),
  estado          estado_licencia DEFAULT 'prueba',
  periodo         periodo_suscripcion DEFAULT 'mensual',
  fecha_inicio    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin       DATE,
  precio_pagado   DECIMAL(10,2),
  notas           TEXT,
  created_by      UUID REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licencias_empresa ON licencias(empresa_id);

-- ============================================================
-- 5. PAGOS
-- ============================================================

CREATE TABLE pagos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  licencia_id     UUID REFERENCES licencias(id),
  monto           DECIMAL(10,2) NOT NULL,
  metodo          metodo_pago DEFAULT 'transferencia',
  referencia      VARCHAR(200),
  fecha_pago      DATE NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url TEXT,
  notas           TEXT,
  registrado_por  UUID REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagos_empresa ON pagos(empresa_id);

-- ============================================================
-- 6. CATEGORÍAS DE PRODUCTOS
-- ============================================================

CREATE TABLE categorias (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  color       VARCHAR(20),
  orden       INTEGER DEFAULT 0,
  es_activo   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categorias_empresa ON categorias(empresa_id);

-- ============================================================
-- 7. PRODUCTOS
-- ============================================================

CREATE TABLE productos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id    UUID REFERENCES categorias(id) ON DELETE SET NULL,
  codigo          VARCHAR(100),
  nombre          VARCHAR(300) NOT NULL,
  descripcion     TEXT,
  precio          DECIMAL(10,2) NOT NULL DEFAULT 0,
  costo           DECIMAL(10,2) DEFAULT 0,
  precio_delivery DECIMAL(10,2),
  imagen_url      TEXT,
  stock           INTEGER DEFAULT 0,
  stock_minimo    INTEGER DEFAULT 0,
  tiene_stock     BOOLEAN DEFAULT TRUE,
  es_activo       BOOLEAN DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

CREATE INDEX idx_productos_empresa   ON productos(empresa_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_codigo    ON productos(empresa_id, codigo);

-- ============================================================
-- 8. CLIENTES
-- ============================================================

CREATE TABLE clientes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre          VARCHAR(300) NOT NULL,
  telefono        VARCHAR(30),
  direccion       TEXT,
  referencia      TEXT,
  distrito        VARCHAR(100),
  email           VARCHAR(200),
  dni             VARCHAR(20),
  observaciones   TEXT,
  total_comprado  DECIMAL(12,2) DEFAULT 0,
  total_pedidos   INTEGER DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_empresa  ON clientes(empresa_id);
CREATE INDEX idx_clientes_telefono ON clientes(empresa_id, telefono);

-- ============================================================
-- 9. PEDIDOS
-- ============================================================

CREATE TABLE pedidos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero          SERIAL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
  -- datos del cliente al momento del pedido (puede ser sin cuenta)
  cliente_nombre  VARCHAR(300),
  cliente_telefono VARCHAR(30),
  cliente_direccion TEXT,
  cliente_referencia TEXT,
  cliente_distrito  VARCHAR(100),
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento       DECIMAL(10,2) DEFAULT 0,
  delivery        DECIMAL(10,2) DEFAULT 0,
  impuesto        DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  metodo_pago     metodo_pago DEFAULT 'efectivo',
  estado          estado_pedido DEFAULT 'pendiente',
  observaciones   TEXT,
  atendido_por    UUID REFERENCES usuarios(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pedidos_empresa   ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_cliente   ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado    ON pedidos(empresa_id, estado);
CREATE INDEX idx_pedidos_fecha     ON pedidos(empresa_id, created_at);

-- ============================================================
-- 10. DETALLE DE PEDIDOS
-- ============================================================

CREATE TABLE pedido_items (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pedido_id    UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id  UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre       VARCHAR(300) NOT NULL,
  cantidad     INTEGER NOT NULL DEFAULT 1,
  precio       DECIMAL(10,2) NOT NULL,
  descuento    DECIMAL(10,2) DEFAULT 0,
  subtotal     DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pedido_items_pedido  ON pedido_items(pedido_id);
CREATE INDEX idx_pedido_items_empresa ON pedido_items(empresa_id);

-- ============================================================
-- 11. GASTOS
-- ============================================================

CREATE TABLE categorias_gasto (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre     VARCHAR(150) NOT NULL,
  color      VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gastos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id    UUID REFERENCES categorias_gasto(id) ON DELETE SET NULL,
  concepto        VARCHAR(300) NOT NULL,
  proveedor       VARCHAR(200),
  monto           DECIMAL(10,2) NOT NULL,
  metodo_pago     metodo_pago DEFAULT 'efectivo',
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url TEXT,
  observaciones   TEXT,
  registrado_por  UUID REFERENCES usuarios(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gastos_empresa ON gastos(empresa_id);
CREATE INDEX idx_gastos_fecha   ON gastos(empresa_id, fecha);

-- ============================================================
-- 12. MOVIMIENTOS DE INVENTARIO
-- ============================================================

CREATE TABLE inventario_movimientos (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo         tipo_movimiento NOT NULL,
  cantidad     INTEGER NOT NULL,
  stock_antes  INTEGER NOT NULL,
  stock_despues INTEGER NOT NULL,
  motivo       VARCHAR(300),
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  registrado_por UUID REFERENCES usuarios(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventario_empresa  ON inventario_movimientos(empresa_id);
CREATE INDEX idx_inventario_producto ON inventario_movimientos(producto_id);

-- ============================================================
-- 13. NOTIFICACIONES
-- ============================================================

CREATE TABLE notificaciones (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id   UUID REFERENCES empresas(id) ON DELETE CASCADE, -- NULL = todas las empresas
  titulo       VARCHAR(300) NOT NULL,
  mensaje      TEXT NOT NULL,
  tipo         VARCHAR(50) DEFAULT 'info',
  leida        BOOLEAN DEFAULT FALSE,
  url_accion   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_empresa ON notificaciones(empresa_id);
CREATE INDEX idx_notificaciones_leida   ON notificaciones(empresa_id, leida);

-- ============================================================
-- 14. AUDITORÍA
-- ============================================================

CREATE TABLE auditoria (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empresa_id  UUID REFERENCES empresas(id) ON DELETE SET NULL,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tabla       VARCHAR(100) NOT NULL,
  accion      VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  registro_id UUID,
  datos_antes JSONB,
  datos_despues JSONB,
  ip          VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auditoria_empresa ON auditoria(empresa_id);
CREATE INDEX idx_auditoria_tabla   ON auditoria(tabla, created_at);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['planes','empresas','usuarios','licencias','categorias','productos','clientes','pedidos','gastos'] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCIÓN: Actualizar totales de cliente al completar pedido
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_totales_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregado' AND OLD.estado != 'entregado' AND NEW.cliente_id IS NOT NULL THEN
    UPDATE clientes
    SET total_comprado = total_comprado + NEW.total,
        total_pedidos  = total_pedidos + 1
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_actualizar_cliente
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION actualizar_totales_cliente();

-- ============================================================
-- FUNCIÓN: Control de stock al registrar pedido
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE v_stock INTEGER;
BEGIN
  IF NEW.producto_id IS NOT NULL THEN
    SELECT stock INTO v_stock FROM productos WHERE id = NEW.producto_id;
    INSERT INTO inventario_movimientos (empresa_id, producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, pedido_id)
    VALUES (NEW.empresa_id, NEW.producto_id, 'salida', NEW.cantidad, v_stock, v_stock - NEW.cantidad, 'Pedido', NEW.pedido_id);
    UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id AND tiene_stock = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_stock_pedido_item
  AFTER INSERT ON pedido_items
  FOR EACH ROW EXECUTE FUNCTION registrar_movimiento_stock();

-- ============================================================
-- VISTA: Resumen de ventas por empresa
-- ============================================================

CREATE VIEW vista_ventas_empresa AS
SELECT
  e.id AS empresa_id,
  e.nombre AS empresa,
  DATE_TRUNC('day', p.created_at) AS fecha,
  COUNT(p.id) AS total_pedidos,
  SUM(CASE WHEN p.estado = 'entregado' THEN p.total ELSE 0 END) AS ventas,
  SUM(CASE WHEN p.estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
FROM empresas e
LEFT JOIN pedidos p ON p.empresa_id = e.id
GROUP BY e.id, e.nombre, DATE_TRUNC('day', p.created_at);

-- ============================================================
-- VISTA: Dashboard super admin
-- ============================================================

CREATE VIEW vista_super_admin_dashboard AS
SELECT
  (SELECT COUNT(*) FROM empresas WHERE deleted_at IS NULL) AS total_empresas,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'activa' AND deleted_at IS NULL) AS empresas_activas,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'prueba' AND deleted_at IS NULL) AS empresas_prueba,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'suspendida' AND deleted_at IS NULL) AS empresas_suspendidas,
  (SELECT COUNT(*) FROM usuarios WHERE deleted_at IS NULL) AS total_usuarios,
  (SELECT COALESCE(SUM(total),0) FROM pedidos WHERE estado = 'entregado' AND created_at >= DATE_TRUNC('month', NOW())) AS ventas_mes,
  (SELECT COUNT(*) FROM pedidos WHERE created_at >= DATE_TRUNC('day', NOW())) AS pedidos_hoy,
  (SELECT COALESCE(SUM(monto),0) FROM pagos WHERE fecha_pago >= DATE_TRUNC('month', NOW())) AS ingresos_mes;

-- ============================================================
-- DATOS SEMILLA: Planes
-- ============================================================

INSERT INTO planes (nombre, descripcion, precio_mensual, precio_anual, max_usuarios, max_productos, max_clientes, max_pedidos_mes, max_sucursales, tiene_reportes, tiene_inventario, tiene_api, orden, color) VALUES
  ('Gratis',        'Para probar el sistema',        0,    0,    1,  50,   100,  100,  1, FALSE, FALSE, FALSE, 1, '#888780'),
  ('Emprendedor',   'Ideal para iniciar tu negocio', 29,   290,  3,  500,  500,  500,  1, TRUE,  FALSE, FALSE, 2, '#378ADD'),
  ('Profesional',   'Para negocios en crecimiento',  59,   590,  10, 9999, 9999, 9999, 1, TRUE,  TRUE,  FALSE, 3, '#1D9E75'),
  ('Premium',       'Sin límites, todas las funciones', 99, 990, 9999,9999,9999,9999, 5, TRUE,  TRUE,  TRUE,  4, '#7F77DD');

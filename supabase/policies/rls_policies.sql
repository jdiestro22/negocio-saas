-- ============================================================
-- ROW LEVEL SECURITY (RLS) - NEGOCIO SAAS
-- Aislamiento total entre empresas
-- ============================================================

-- Habilitar RLS en todas las tablas de tenant
ALTER TABLE empresas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE licencias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_gasto  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIÓN DE AYUDA: obtener empresa_id del usuario actual
-- ============================================================

CREATE OR REPLACE FUNCTION get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM usuarios
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN DE AYUDA: verificar si es super admin
-- ============================================================

CREATE OR REPLACE FUNCTION es_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE auth_user_id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN DE AYUDA: verificar si es admin de empresa
-- ============================================================

CREATE OR REPLACE FUNCTION es_admin_empresa()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE auth_user_id = auth.uid() AND rol IN ('super_admin', 'admin_empresa')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- POLÍTICAS: EMPRESAS
-- ============================================================

-- Super admin puede ver todo
CREATE POLICY "super_admin_ve_todo" ON empresas
  FOR ALL USING (es_super_admin());

-- Cada empresa solo ve su propia fila
CREATE POLICY "empresa_ve_propia" ON empresas
  FOR SELECT USING (id = get_empresa_id());

-- ============================================================
-- POLÍTICAS: USUARIOS
-- ============================================================

CREATE POLICY "super_admin_gestiona_usuarios" ON usuarios
  FOR ALL USING (es_super_admin());

CREATE POLICY "empresa_ve_sus_usuarios" ON usuarios
  FOR SELECT USING (empresa_id = get_empresa_id());

CREATE POLICY "admin_empresa_gestiona_usuarios" ON usuarios
  FOR ALL USING (empresa_id = get_empresa_id() AND es_admin_empresa());

-- El usuario puede ver y actualizar su propio perfil
CREATE POLICY "usuario_ve_propio" ON usuarios
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "usuario_actualiza_propio" ON usuarios
  FOR UPDATE USING (auth_user_id = auth.uid());

-- ============================================================
-- POLÍTICA GENÉRICA PARA TABLAS CON empresa_id
-- Aplica a: categorias, productos, clientes, pedidos,
--           pedido_items, gastos, categorias_gasto,
--           inventario_movimientos, licencias, pagos
-- ============================================================

-- Macro para crear políticas RLS estándar por tabla
-- Se ejecuta para cada tabla
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'categorias', 'productos', 'clientes', 'pedidos',
    'pedido_items', 'gastos', 'categorias_gasto',
    'inventario_movimientos', 'licencias', 'pagos'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- Super admin: acceso total
    EXECUTE format(
      'CREATE POLICY "%s_super_admin_all" ON %I FOR ALL USING (es_super_admin())',
      t, t
    );
    -- Empresa: solo ve sus propios datos
    EXECUTE format(
      'CREATE POLICY "%s_empresa_propia" ON %I FOR ALL USING (empresa_id = get_empresa_id())',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- POLÍTICAS: NOTIFICACIONES
-- ============================================================

CREATE POLICY "notificaciones_empresa" ON notificaciones
  FOR SELECT USING (
    empresa_id = get_empresa_id()
    OR empresa_id IS NULL  -- notificaciones globales del super admin
  );

CREATE POLICY "notificaciones_super_admin_all" ON notificaciones
  FOR ALL USING (es_super_admin());

-- ============================================================
-- PLANES: público para lectura (no tienen empresa_id)
-- ============================================================

ALTER TABLE planes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planes_lectura_publica" ON planes
  FOR SELECT USING (es_activo = TRUE);

CREATE POLICY "planes_super_admin" ON planes
  FOR ALL USING (es_super_admin());

-- ============================================================
-- TABLA DE AUDITORÍA: solo super admin
-- ============================================================

CREATE POLICY "auditoria_super_admin" ON auditoria
  FOR ALL USING (es_super_admin());

CREATE POLICY "auditoria_empresa" ON auditoria
  FOR SELECT USING (empresa_id = get_empresa_id() AND es_admin_empresa());

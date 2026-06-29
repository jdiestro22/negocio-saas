// ============================================================
// TIPOS TYPESCRIPT - NEGOCIO SAAS
// ============================================================

export type EstadoEmpresa = 'prueba' | 'activa' | 'suspendida' | 'vencida'
export type EstadoPedido = 'pendiente' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado'
export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta' | 'otro'
export type RolUsuario = 'super_admin' | 'admin_empresa' | 'empleado'
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'
export type PeriodoSuscripcion = 'mensual' | 'trimestral' | 'semestral' | 'anual'

// -------------------------------------------------------
// Plan
// -------------------------------------------------------
export interface Plan {
  id: string
  nombre: string
  descripcion: string | null
  precio_mensual: number
  precio_anual: number | null
  max_usuarios: number
  max_productos: number
  max_clientes: number
  max_pedidos_mes: number
  max_sucursales: number
  tiene_reportes: boolean
  tiene_dashboard: boolean
  tiene_inventario: boolean
  tiene_api: boolean
  es_activo: boolean
  orden: number
  color: string
  created_at: string
  updated_at: string
}

// -------------------------------------------------------
// Empresa (Tenant)
// -------------------------------------------------------
export interface Empresa {
  id: string
  nombre: string
  slug: string | null
  ruc: string | null
  direccion: string | null
  telefono: string | null
  whatsapp: string | null
  email: string | null
  logo_url: string | null
  moneda: string
  simbolo_moneda: string
  impuesto_pct: number
  tipo_negocio: string | null
  plan_id: string | null
  estado: EstadoEmpresa
  fecha_inicio: string
  fecha_vencimiento: string | null
  tema: string
  configuracion: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
  // relaciones
  plan?: Plan
}

// -------------------------------------------------------
// Usuario
// -------------------------------------------------------
export interface Usuario {
  id: string
  auth_user_id: string
  empresa_id: string | null
  nombre: string
  email: string
  telefono: string | null
  rol: RolUsuario
  permisos: Record<string, boolean>
  avatar_url: string | null
  es_activo: boolean
  ultimo_acceso: string | null
  created_at: string
  updated_at: string
  // relaciones
  empresa?: Empresa
}

// -------------------------------------------------------
// Categoría de producto
// -------------------------------------------------------
export interface Categoria {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string | null
  color: string | null
  orden: number
  es_activo: boolean
  created_at: string
  updated_at: string
}

// -------------------------------------------------------
// Producto
// -------------------------------------------------------
export interface Producto {
  id: string
  empresa_id: string
  categoria_id: string | null
  codigo: string | null
  nombre: string
  descripcion: string | null
  precio: number
  costo: number
  precio_delivery: number | null
  imagen_url: string | null
  stock: number
  stock_minimo: number
  tiene_stock: boolean
  es_activo: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  // relaciones
  categoria?: Categoria
  // calculados
  utilidad?: number
  margen?: number
}

// -------------------------------------------------------
// Cliente
// -------------------------------------------------------
export interface Cliente {
  id: string
  empresa_id: string
  nombre: string
  telefono: string | null
  direccion: string | null
  referencia: string | null
  distrito: string | null
  email: string | null
  dni: string | null
  observaciones: string | null
  total_comprado: number
  total_pedidos: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// -------------------------------------------------------
// Pedido
// -------------------------------------------------------
export interface PedidoItem {
  id?: string
  empresa_id?: string
  pedido_id?: string
  producto_id: string | null
  nombre: string
  cantidad: number
  precio: number
  descuento: number
  subtotal: number
  // relaciones
  producto?: Producto
}

export interface Pedido {
  id: string
  empresa_id: string
  numero: number
  cliente_id: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
  cliente_referencia: string | null
  cliente_distrito: string | null
  subtotal: number
  descuento: number
  delivery: number
  impuesto: number
  total: number
  metodo_pago: MetodoPago
  estado: EstadoPedido
  observaciones: string | null
  atendido_por: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // relaciones
  cliente?: Cliente
  items?: PedidoItem[]
}

// -------------------------------------------------------
// Gasto
// -------------------------------------------------------
export interface Gasto {
  id: string
  empresa_id: string
  categoria_id: string | null
  concepto: string
  proveedor: string | null
  monto: number
  metodo_pago: MetodoPago
  fecha: string
  comprobante_url: string | null
  observaciones: string | null
  registrado_por: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// -------------------------------------------------------
// Dashboard types
// -------------------------------------------------------
export interface DashboardEmpresa {
  ventas_hoy: number
  ventas_mes: number
  pedidos_pendientes: number
  pedidos_entregados_hoy: number
  total_clientes: number
  total_productos: number
  gastos_mes: number
  ganancia_mes: number
  productos_bajo_stock: number
}

export interface DashboardSuperAdmin {
  total_empresas: number
  empresas_activas: number
  empresas_prueba: number
  empresas_suspendidas: number
  total_usuarios: number
  ventas_mes: number
  pedidos_hoy: number
  ingresos_mes: number
}

// -------------------------------------------------------
// Colores de estado
// -------------------------------------------------------
export const ESTADO_PEDIDO_CONFIG: Record<EstadoPedido, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#EF9F27', bg: '#FAEEDA' },
  preparando: { label: 'Preparando', color: '#378ADD', bg: '#E6F1FB' },
  en_camino:  { label: 'En camino',  color: '#7F77DD', bg: '#EEEDFE' },
  entregado:  { label: 'Entregado',  color: '#1D9E75', bg: '#E1F5EE' },
  cancelado:  { label: 'Cancelado',  color: '#E24B4A', bg: '#FCEBEB' },
}

export const ESTADO_EMPRESA_CONFIG: Record<EstadoEmpresa, { label: string; color: string }> = {
  prueba:     { label: 'Prueba',      color: '#EF9F27' },
  activa:     { label: 'Activa',      color: '#1D9E75' },
  suspendida: { label: 'Suspendida',  color: '#E24B4A' },
  vencida:    { label: 'Vencida',     color: '#888780' },
}

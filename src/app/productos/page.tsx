'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Producto = {
  id: string
  nombre: string
  codigo: string | null
  precio: number
  costo: number
  stock: number
  stock_minimo: number
  tiene_stock: boolean
  es_activo: boolean
  imagen_url: string | null
  categorias: { nombre: string } | null
}

export default function ProductosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)

  // Formulario
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [precio, setPrecio] = useState('')
  const [costo, setCosto] = useState('')
  const [stock, setStock] = useState('')
  const [stockMinimo, setStockMinimo] = useState('5')
  const [tieneStock, setTieneStock] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_user_id', user.id)
        .single()
      if (data?.empresa_id) {
        setEmpresaId(data.empresa_id)
        cargarProductos(data.empresa_id)
      }
    }
    init()
  }, [])

  const cargarProductos = async (eid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, codigo, precio, costo, stock, stock_minimo, tiene_stock, es_activo, imagen_url, categorias(nombre)')
      .eq('empresa_id', eid)
      .is('deleted_at', null)
      .order('nombre')
    setProductos((data ?? []) as any)
    setLoading(false)
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => {
    setEditando(null)
    setNombre('')
    setCodigo('')
    setPrecio('')
    setCosto('')
    setStock('')
    setStockMinimo('5')
    setTieneStock(true)
    setError(null)
    setModalAbierto(true)
  }

  const abrirEditar = (p: Producto) => {
    setEditando(p)
    setNombre(p.nombre)
    setCodigo(p.codigo ?? '')
    setPrecio(p.precio.toString())
    setCosto(p.costo.toString())
    setStock(p.stock.toString())
    setStockMinimo(p.stock_minimo.toString())
    setTieneStock(p.tiene_stock)
    setError(null)
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    if (!precio || isNaN(Number(precio))) return setError('Ingresa un precio válido')
    if (!empresaId) return
    setGuardando(true)
    setError(null)

    const datos = {
      empresa_id: empresaId,
      nombre: nombre.trim(),
      codigo: codigo.trim() || null,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: tieneStock ? Number(stock) || 0 : 0,
      stock_minimo: Number(stockMinimo) || 0,
      tiene_stock: tieneStock,
      es_activo: true,
    }

    if (editando) {
      await supabase.from('productos').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('productos').insert(datos)
    }

    setGuardando(false)
    setModalAbierto(false)
    cargarProductos(empresaId)
  }

  const toggleActivo = async (p: Producto) => {
    await supabase.from('productos').update({ es_activo: !p.es_activo }).eq('id', p.id)
    if (empresaId) cargarProductos(empresaId)
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (empresaId) cargarProductos(empresaId)
  }

  const utilidad = (p: number, c: number) => p > 0 ? (((p - c) / p) * 100).toFixed(0) : '0'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Productos</h1>
          <span className="text-sm text-gray-400">{productos.length} registrados</span>
        </div>
        <button onClick={abrirNuevo}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Nuevo producto
        </button>
      </div>

      {/* Buscador */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <input type="text" placeholder="Buscar por nombre o código..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      <div className="p-4 max-w-4xl mx-auto">
        {loading && <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>}

        {!loading && productosFiltrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-500 text-sm">No hay productos registrados</p>
            <button onClick={abrirNuevo}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Agregar primer producto
            </button>
          </div>
        )}

        <div className="space-y-2">
          {productosFiltrados.map(p => (
            <div key={p.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!p.es_activo ? 'opacity-50' : ''}`}>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{p.nombre}</span>
                  {p.codigo && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{p.codigo}</span>}
                  {p.tiene_stock && p.stock <= p.stock_minimo && (
                    <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Stock bajo</span>
                  )}
                </div>
                {p.categorias && (
                  <span className="text-xs text-gray-400">{p.categorias.nombre}</span>
                )}
              </div>

              {/* Precios */}
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900">S/ {p.precio.toFixed(2)}</div>
                {p.costo > 0 && (
                  <div className="text-xs text-green-600">{utilidad(p.precio, p.costo)}% margen</div>
                )}
              </div>

              {/* Stock */}
              {p.tiene_stock && (
                <div className="text-center hidden sm:block w-16">
                  <div className={`text-sm font-medium ${p.stock <= p.stock_minimo ? 'text-orange-600' : 'text-gray-900'}`}>
                    {p.stock}
                  </div>
                  <div className="text-xs text-gray-400">stock</div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <button onClick={() => abrirEditar(p)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  Editar
                </button>
                <button onClick={() => toggleActivo(p)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg ${p.es_activo ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {p.es_activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => eliminar(p.id)}
                  className="text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nuevo/editar producto */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-900">
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: 1/4 Pollo a la Brasa"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Código (opcional)</label>
                <input type="text" value={codigo} onChange={e => setCodigo(e.target.value)}
                  placeholder="Ej: POL-001"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Precio de venta *</label>
                  <input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Costo (opcional)</label>
                  <input type="number" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {precio && costo && Number(costo) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  Margen: {utilidad(Number(precio), Number(costo))}% · Ganancia: S/ {(Number(precio) - Number(costo)).toFixed(2)} por unidad
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="tiene_stock" checked={tieneStock}
                  onChange={e => setTieneStock(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="tiene_stock" className="text-sm text-gray-700">Controlar stock</label>
              </div>

              {tieneStock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Stock actual</label>
                    <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Stock mínimo</label>
                    <input type="number" min="0" value={stockMinimo} onChange={e => setStockMinimo(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalAbierto(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={guardar} disabled={guardando}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
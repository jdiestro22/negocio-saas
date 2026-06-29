'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Pedido = {
  id: string
  numero: number
  cliente_nombre: string | null
  cliente_direccion: string | null
  cliente_distrito: string | null
  total: number
  estado: string
  metodo_pago: string
  created_at: string
}

const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#EF9F27', bg: '#FEF3CD' },
  preparando: { label: 'Preparando', color: '#378ADD', bg: '#DDEEFF' },
  en_camino:  { label: 'En camino',  color: '#7F77DD', bg: '#EEEDFE' },
  entregado:  { label: 'Entregado',  color: '#1D9E75', bg: '#D4F5E9' },
  cancelado:  { label: 'Cancelado',  color: '#E24B4A', bg: '#FDEAEA' },
}

export default function PedidosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)

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
        cargarPedidos(data.empresa_id)
      }
    }
    init()
  }, [])

  const cargarPedidos = async (eid: string) => {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, cliente_nombre, cliente_direccion, cliente_distrito, total, estado, metodo_pago, created_at')
      .eq('empresa_id', eid)
      .gte('created_at', hoy)
      .order('created_at', { ascending: false })
    setPedidos((data ?? []) as Pedido[])
    setLoading(false)
  }

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from('pedidos').update({ estado }).eq('id', id)
    if (empresaId) cargarPedidos(empresaId)
  }

  const pedidosFiltrados = filtro === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === filtro)

  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Pedidos de hoy</h1>
          <span className="text-sm text-gray-400">{pedidos.length} pedidos</span>
        </div>
        <button onClick={() => router.push('/pedidos/nuevo')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Nuevo pedido
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-2 overflow-x-auto">
        {['todos', 'pendiente', 'preparando', 'en_camino', 'entregado', 'cancelado'].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filtro === e ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {e === 'todos' ? 'Todos' : ESTADOS[e]?.label}
            {e !== 'todos' && (
              <span className="ml-1">({pedidos.filter(p => p.estado === e).length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {loading && <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>}

        {!loading && pedidosFiltrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🛵</div>
            <p className="text-gray-500 text-sm">No hay pedidos {filtro !== 'todos' ? `en estado "${ESTADOS[filtro]?.label}"` : 'hoy'}</p>
            <button onClick={() => router.push('/pedidos/nuevo')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Registrar primer pedido
            </button>
          </div>
        )}

        {pedidosFiltrados.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">#{p.numero}</span>
                  <span className="text-sm text-gray-700">{p.cliente_nombre ?? 'Sin nombre'}</span>
                </div>
                {p.cliente_direccion && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {p.cliente_direccion}{p.cliente_distrito ? ` · ${p.cliente_distrito}` : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">S/ {p.total.toFixed(2)}</div>
                <div className="text-xs text-gray-400">{hora(p.created_at)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ background: ESTADOS[p.estado]?.bg, color: ESTADOS[p.estado]?.color }}
                className="text-xs font-medium px-2.5 py-1 rounded-full">
                {ESTADOS[p.estado]?.label}
              </span>

              {/* Cambiar estado rápido */}
              <div className="flex gap-1">
                {p.estado === 'pendiente' && (
                  <button onClick={() => cambiarEstado(p.id, 'preparando')}
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">
                    Preparando →
                  </button>
                )}
                {p.estado === 'preparando' && (
                  <button onClick={() => cambiarEstado(p.id, 'en_camino')}
                    className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">
                    En camino →
                  </button>
                )}
                {p.estado === 'en_camino' && (
                  <button onClick={() => cambiarEstado(p.id, 'entregado')}
                    className="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                    Entregado ✓
                  </button>
                )}
                {(p.estado === 'pendiente' || p.estado === 'preparando') && (
                  <button onClick={() => cambiarEstado(p.id, 'cancelado')}
                    className="text-xs px-2.5 py-1 bg-red-50 text-red-500 rounded-full hover:bg-red-100">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
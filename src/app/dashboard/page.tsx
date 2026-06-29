'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stats = {
  ventas_hoy: number
  ventas_mes: number
  pedidos_pendientes: number
  pedidos_entregados_hoy: number
  total_clientes: number
  total_productos: number
  gastos_mes: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [empresa, setEmpresa] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id, nombre, empresas(nombre)')
        .eq('auth_user_id', user.id)
        .single()

      if (!usuario?.empresa_id) {
        setEmpresa('Super Admin')
        setLoading(false)
        return
      }

      const empresaNombre = (usuario.empresas as any)?.nombre ?? ''
      setEmpresa(empresaNombre)

      const hoy = new Date().toISOString().split('T')[0]
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [ventasHoy, ventasMes, pendientes, entregadosHoy, clientes, productos, gastosMes] =
        await Promise.all([
          supabase.from('pedidos').select('total')
            .eq('empresa_id', usuario.empresa_id)
            .eq('estado', 'entregado')
            .gte('created_at', hoy),
          supabase.from('pedidos').select('total')
            .eq('empresa_id', usuario.empresa_id)
            .eq('estado', 'entregado')
            .gte('created_at', inicioMes),
          supabase.from('pedidos').select('id', { count: 'exact' })
            .eq('empresa_id', usuario.empresa_id)
            .eq('estado', 'pendiente'),
          supabase.from('pedidos').select('id', { count: 'exact' })
            .eq('empresa_id', usuario.empresa_id)
            .eq('estado', 'entregado')
            .gte('created_at', hoy),
          supabase.from('clientes').select('id', { count: 'exact' })
            .eq('empresa_id', usuario.empresa_id),
          supabase.from('productos').select('id', { count: 'exact' })
            .eq('empresa_id', usuario.empresa_id)
            .eq('es_activo', true),
          supabase.from('gastos').select('monto')
            .eq('empresa_id', usuario.empresa_id)
            .gte('fecha', inicioMes.split('T')[0]),
        ])

      setStats({
        ventas_hoy: (ventasHoy.data ?? []).reduce((a, p) => a + p.total, 0),
        ventas_mes: (ventasMes.data ?? []).reduce((a, p) => a + p.total, 0),
        pedidos_pendientes: pendientes.count ?? 0,
        pedidos_entregados_hoy: entregadosHoy.count ?? 0,
        total_clientes: clientes.count ?? 0,
        total_productos: productos.count ?? 0,
        gastos_mes: (gastosMes.data ?? []).reduce((a, g) => a + g.monto, 0),
      })

      setLoading(false)
    }

    cargar()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Cargando...</div>
      </div>
    )
  }

  const tarjetas = stats ? [
    { label: 'Ventas hoy',           valor: `S/ ${stats.ventas_hoy.toFixed(2)}`,          color: 'text-green-600' },
    { label: 'Ventas del mes',        valor: `S/ ${stats.ventas_mes.toFixed(2)}`,           color: 'text-blue-600' },
    { label: 'Pedidos pendientes',    valor: stats.pedidos_pendientes.toString(),            color: 'text-yellow-600' },
    { label: 'Entregados hoy',        valor: stats.pedidos_entregados_hoy.toString(),        color: 'text-green-600' },
    { label: 'Clientes registrados',  valor: stats.total_clientes.toString(),                color: 'text-gray-900' },
    { label: 'Productos activos',     valor: stats.total_productos.toString(),               color: 'text-gray-900' },
    { label: 'Gastos del mes',        valor: `S/ ${stats.gastos_mes.toFixed(2)}`,           color: 'text-red-600' },
    { label: 'Ganancia estimada',     valor: `S/ ${(stats.ventas_mes - stats.gastos_mes).toFixed(2)}`, color: 'text-green-600' },
  ] : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{empresa}</p>
        </div>
        <button
          onClick={async () => {
            await createClient().auth.signOut()
            window.location.href = '/login'
          }}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="p-6">
        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {tarjetas.map((t, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-2">{t.label}</div>
              <div className={`text-2xl font-semibold ${t.color}`}>{t.valor}</div>
            </div>
          ))}
        </div>

        {/* Accesos rápidos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Accesos rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Nuevo pedido',  href: '/pedidos/nuevo',  emoji: '🛒' },
              { label: 'Productos',     href: '/productos',       emoji: '📦' },
              { label: 'Clientes',      href: '/clientes',        emoji: '👥' },
              { label: 'Reportes',      href: '/reportes',        emoji: '📊' },
            ].map((a, i) => (
              <a key={i} href={a.href}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="text-2xl mb-2">{a.emoji}</span>
                <span className="text-sm text-gray-700">{a.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}



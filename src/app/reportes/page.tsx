'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type PedidoReporte = {
  id: string
  numero: number
  total: number
  metodo_pago: string
  estado: string
  created_at: string
  cliente_nombre: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
}

type ItemReporte = {
  nombre: string
  cantidad: number
  subtotal: number
}

const METODOS_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

export default function ReportesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros de fecha
  const hoy = new Date().toISOString().split('T')[0]
  const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [fechaInicio, setFechaInicio] = useState(haceUnaSemana)
  const [fechaFin, setFechaFin] = useState(hoy)

  const [pedidos, setPedidos] = useState<PedidoReporte[]>([])
  const [productosTop, setProductosTop] = useState<{ nombre: string; cantidad: number; total: number }[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_user_id', user.id)
        .single()
      if (data?.empresa_id) setEmpresaId(data.empresa_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (empresaId) cargarReporte()
  }, [empresaId, fechaInicio, fechaFin])

  const cargarReporte = async () => {
    if (!empresaId) return
    setLoading(true)

    const fin = new Date(fechaFin)
    fin.setDate(fin.getDate() + 1)
    const finStr = fin.toISOString().split('T')[0]

    // Pedidos entregados en el rango
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('id, numero, total, metodo_pago, estado, created_at, cliente_nombre, cliente_telefono, cliente_direccion')
      .eq('empresa_id', empresaId)
      .eq('estado', 'entregado')
      .gte('created_at', fechaInicio)
      .lt('created_at', finStr)
      .order('created_at', { ascending: false })

    setPedidos((pedidosData ?? []) as PedidoReporte[])

    // Productos más vendidos en el rango
    const { data: itemsData } = await supabase
      .from('pedido_items')
      .select('nombre, cantidad, subtotal, pedidos!inner(estado, created_at, empresa_id)')
      .eq('empresa_id', empresaId)
      .eq('pedidos.estado', 'entregado')
      .gte('pedidos.created_at', fechaInicio)
      .lt('pedidos.created_at', finStr)

    const agrupado: Record<string, { cantidad: number; total: number }> = {}
    ;(itemsData ?? []).forEach((it: any) => {
      if (!agrupado[it.nombre]) agrupado[it.nombre] = { cantidad: 0, total: 0 }
      agrupado[it.nombre].cantidad += it.cantidad
      agrupado[it.nombre].total += it.subtotal
    })

    const top = Object.entries(agrupado)
      .map(([nombre, v]) => ({ nombre, cantidad: v.cantidad, total: v.total }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)

    setProductosTop(top)
    setLoading(false)
  }

  // Ventas agrupadas por día para el gráfico
  const ventasPorDia = useMemo(() => {
    const agrupado: Record<string, number> = {}
    pedidos.forEach(p => {
      const dia = p.created_at.split('T')[0]
      agrupado[dia] = (agrupado[dia] ?? 0) + p.total
    })
    return Object.entries(agrupado)
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [pedidos])

  // Ventas por método de pago
  const ventasPorMetodo = useMemo(() => {
    const agrupado: Record<string, number> = {}
    pedidos.forEach(p => {
      agrupado[p.metodo_pago] = (agrupado[p.metodo_pago] ?? 0) + p.total
    })
    return Object.entries(agrupado).map(([metodo, total]) => ({ metodo, total }))
  }, [pedidos])

  const totalVentas = pedidos.reduce((a, p) => a + p.total, 0)
  const totalPedidos = pedidos.length
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0
  const maxVentaDia = Math.max(...ventasPorDia.map(v => v.total), 1)

  const formatearFecha = (f: string) => {
    const [, m, d] = f.split('-')
    return `${d}/${m}`
  }

  // Exportar a Excel
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen de pedidos
    const hojaPedidos = pedidos.map(p => ({
    'N° Pedido': p.numero,
    'Fecha': new Date(p.created_at).toLocaleDateString('es-PE'),
    'Hora': new Date(p.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    'Cliente': p.cliente_nombre ?? 'Sin nombre',
    'Teléfono': p.cliente_telefono ?? '',
    'Dirección': p.cliente_direccion ?? '',
    'Método de pago': METODOS_LABEL[p.metodo_pago] ?? p.metodo_pago,
    'Total': p.total,
    }))
    const ws1 = XLSX.utils.json_to_sheet(hojaPedidos)
    XLSX.utils.book_append_sheet(wb, ws1, 'Pedidos')

    // Hoja 2: Productos más vendidos
    const hojaProductos = productosTop.map(p => ({
      'Producto': p.nombre,
      'Cantidad vendida': p.cantidad,
      'Total generado': p.total,
    }))
    const ws2 = XLSX.utils.json_to_sheet(hojaProductos)
    XLSX.utils.book_append_sheet(wb, ws2, 'Productos top')

    // Hoja 3: Resumen general
    const resumen = [
      { 'Indicador': 'Periodo', 'Valor': `${fechaInicio} al ${fechaFin}` },
      { 'Indicador': 'Total de ventas', 'Valor': totalVentas.toFixed(2) },
      { 'Indicador': 'Total de pedidos', 'Valor': totalPedidos },
      { 'Indicador': 'Ticket promedio', 'Valor': ticketPromedio.toFixed(2) },
    ]
    const ws3 = XLSX.utils.json_to_sheet(resumen)
    XLSX.utils.book_append_sheet(wb, ws3, 'Resumen')

    XLSX.writeFile(wb, `reporte-ventas-${fechaInicio}-a-${fechaFin}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Reportes de ventas</h1>
        </div>
        <button onClick={exportarExcel} disabled={pedidos.length === 0}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          ⬇ Exportar Excel
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Desde</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Atajos rápidos */}
        <div className="flex gap-2 ml-2">
          <button onClick={() => { setFechaInicio(hoy); setFechaFin(hoy) }}
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">Hoy</button>
          <button onClick={() => { setFechaInicio(haceUnaSemana); setFechaFin(hoy) }}
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">7 días</button>
          <button onClick={() => {
            const inicio = new Date(); inicio.setDate(1)
            setFechaInicio(inicio.toISOString().split('T')[0]); setFechaFin(hoy)
          }} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200">Este mes</button>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto space-y-4">

        {loading && <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>}

        {!loading && (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Total de ventas</div>
                <div className="text-2xl font-semibold text-green-600">S/ {totalVentas.toFixed(2)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Pedidos entregados</div>
                <div className="text-2xl font-semibold text-blue-600">{totalPedidos}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Ticket promedio</div>
                <div className="text-2xl font-semibold text-gray-900">S/ {ticketPromedio.toFixed(2)}</div>
              </div>
            </div>

            {/* Gráfico de barras: ventas por día */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Ventas por día</h2>
              {ventasPorDia.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No hay ventas en este periodo</p>
              ) : (
                <div className="flex items-end gap-2 h-48 overflow-x-auto pb-2">
                  {ventasPorDia.map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0" style={{ minWidth: '48px' }}>
                      <span className="text-xs text-gray-500 whitespace-nowrap">S/{v.total.toFixed(0)}</span>
                      <div
                        className="w-8 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-colors"
                        style={{ height: `${(v.total / maxVentaDia) * 140}px`, minHeight: '4px' }}
                        title={`S/ ${v.total.toFixed(2)}`}
                      />
                      <span className="text-xs text-gray-400">{formatearFecha(v.fecha)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Productos más vendidos */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-900 mb-4">Productos más vendidos</h2>
                {productosTop.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
                ) : (
                  <div className="space-y-3">
                    {productosTop.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="text-sm text-gray-800">{p.nombre}</div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                            <div className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${(p.cantidad / productosTop[0].cantidad) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{p.cantidad}u</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ventas por método de pago */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-900 mb-4">Por método de pago</h2>
                {ventasPorMetodo.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
                ) : (
                  <div className="space-y-3">
                    {ventasPorMetodo.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{METODOS_LABEL[m.metodo] ?? m.metodo}</span>
                        <span className="text-sm font-medium text-gray-900">S/ {m.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de pedidos */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-900">Detalle de pedidos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="text-left px-4 py-2">N°</th>
                      <th className="text-left px-4 py-2">Fecha</th>
                      <th className="text-left px-4 py-2">Cliente</th>
                      <th className="text-left px-4 py-2">Pago</th>
                      <th className="text-right px-4 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.slice(0, 20).map(p => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">#{p.numero}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(p.created_at).toLocaleDateString('es-PE')}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{p.cliente_nombre ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{METODOS_LABEL[p.metodo_pago]}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">S/ {p.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pedidos.length > 20 && (
                <div className="p-3 text-center text-xs text-gray-400 border-t border-gray-100">
                  Mostrando 20 de {pedidos.length} pedidos · Exporta a Excel para ver todos
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
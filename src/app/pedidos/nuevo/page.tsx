'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  direccion: string | null
  referencia: string | null
  distrito: string | null
}

type Producto = {
  id: string
  nombre: string
  precio: number
  precio_delivery: number | null
  categorias?: { nombre: string } | null
}

type Item = {
  producto_id: string
  nombre: string
  cantidad: number
  precio: number
  subtotal: number
}

type TipoEntrega = 'local' | 'delivery'
type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta'

export default function NuevoPedidoPage() {
  const supabase = createClient()
  const router = useRouter()

  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('delivery')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')

  // Cliente
  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteSugerencias, setClienteSugerencias] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [direccion, setDireccion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [distrito, setDistrito] = useState('')
  const [telefono, setTelefono] = useState('')

  // Productos
  const [productoQuery, setProductoQuery] = useState('')
  const [productoSugerencias, setProductoSugerencias] = useState<Producto[]>([])
  const [items, setItems] = useState<Item[]>([])

  // Totales
  const [descuento, setDescuento] = useState(0)
  const [costoDelivery, setCostoDelivery] = useState(5)
  const [observaciones, setObservaciones] = useState('')

  // UI
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
      if (data?.empresa_id) setEmpresaId(data.empresa_id)
    }
    init()
  }, [])

  const buscarClientes = useCallback(async (q: string) => {
    if (!empresaId || q.length < 2) return setClienteSugerencias([])
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, direccion, referencia, distrito')
      .eq('empresa_id', empresaId)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
      .limit(5)
    setClienteSugerencias((data ?? []) as Cliente[])
  }, [empresaId, supabase])

  const seleccionarCliente = (c: Cliente) => {
    setClienteSeleccionado(c)
    setClienteQuery(c.nombre)
    setTelefono(c.telefono ?? '')
    setDireccion(c.direccion ?? '')
    setReferencia(c.referencia ?? '')
    setDistrito(c.distrito ?? '')
    setClienteSugerencias([])
  }

  const buscarProductos = useCallback(async (q: string) => {
    if (!empresaId || q.length < 1) return setProductoSugerencias([])
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio, precio_delivery, categorias(nombre)')
      .eq('empresa_id', empresaId)
      .eq('es_activo', true)
      .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`)
      .limit(8)
    setProductoSugerencias((data ?? []) as any)
  }, [empresaId, supabase])

  const agregarProducto = (p: Producto) => {
    const precio = tipoEntrega === 'delivery' && p.precio_delivery ? p.precio_delivery : p.precio
    setItems(prev => {
      const existe = prev.find(i => i.producto_id === p.id)
      if (existe) {
        return prev.map(i => i.producto_id === p.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio }
          : i
        )
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio, subtotal: precio }]
    })
    setProductoQuery('')
    setProductoSugerencias([])
  }

  const cambiarCantidad = (idx: number, delta: number) => {
    setItems(prev => prev
      .map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + delta, subtotal: (it.cantidad + delta) * it.precio } : it)
      .filter(it => it.cantidad > 0)
    )
  }

  const subtotal = items.reduce((a, i) => a + i.subtotal, 0)
  const deliveryCosto = tipoEntrega === 'delivery' ? costoDelivery : 0
  const total = subtotal - descuento + deliveryCosto

  const guardar = async () => {
    if (items.length === 0) return setError('Agrega al menos un producto')
    if (tipoEntrega === 'delivery' && !direccion) return setError('Ingresa la dirección de entrega')
    if (!empresaId) return setError('No se encontró la empresa')
    setError(null)
    setGuardando(true)

    // Buscar o crear cliente automáticamente si hay teléfono o dirección
    let clienteId = clienteSeleccionado?.id ?? null

    if (!clienteId && (telefono.trim() || direccion.trim())) {
      const nombreCliente = clienteQuery.trim() || 'Sin nombre'

      if (telefono.trim()) {
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('telefono', telefono.trim())
          .single()

        if (clienteExistente) {
          clienteId = clienteExistente.id
          if (direccion.trim()) {
            await supabase.from('clientes').update({
              direccion: direccion.trim() || null,
              referencia: referencia.trim() || null,
              distrito: distrito.trim() || null,
            }).eq('id', clienteId)
          }
        }
      }

      if (!clienteId) {
        const { data: nuevoCliente } = await supabase
          .from('clientes')
          .insert({
            empresa_id: empresaId,
            nombre: nombreCliente,
            telefono: telefono.trim() || null,
            direccion: direccion.trim() || null,
            referencia: referencia.trim() || null,
            distrito: distrito.trim() || null,
          })
          .select('id')
          .single()

        if (nuevoCliente) clienteId = nuevoCliente.id
      }
    }

    const { data: pedido, error: err } = await supabase
      .from('pedidos')
      .insert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        cliente_nombre: (clienteSeleccionado?.nombre ?? clienteQuery.trim()) || null,
        cliente_telefono: telefono || null,
        cliente_direccion: tipoEntrega === 'delivery' ? direccion : null,
        cliente_referencia: tipoEntrega === 'delivery' ? referencia : null,
        cliente_distrito: tipoEntrega === 'delivery' ? distrito : null,
        subtotal,
        descuento,
        delivery: deliveryCosto,
        total,
        metodo_pago: metodoPago,
        estado: 'pendiente',
        observaciones: observaciones || null,
      })
      .select('id')
      .single()

    if (err || !pedido) {
      setError(err?.message ?? 'Error al guardar')
      setGuardando(false)
      return
    }

    await supabase.from('pedido_items').insert(
      items.map(i => ({
        empresa_id: empresaId,
        pedido_id: pedido.id,
        producto_id: i.producto_id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
        descuento: 0,
        subtotal: i.subtotal,
      }))
    )

    router.push('/pedidos')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/pedidos')} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-lg font-semibold text-gray-900">Nuevo pedido</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex gap-2">
            {(['local', 'delivery'] as TipoEntrega[]).map(t => (
              <button key={t} onClick={() => setTipoEntrega(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tipoEntrega === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {t === 'local' ? '🏠 Local' : '🛵 Delivery'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Cliente</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono..."
              value={clienteQuery}
              onChange={e => { setClienteQuery(e.target.value); setClienteSeleccionado(null); buscarClientes(e.target.value) }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {clienteSugerencias.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
                {clienteSugerencias.map(c => (
                  <li key={c.id} onClick={() => seleccionarCliente(c)}
                    className="px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 flex justify-between">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-gray-400">{c.telefono}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            type="text"
            placeholder="Teléfono"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {tipoEntrega === 'delivery' && (
            <>
              <input
                type="text"
                placeholder="Dirección *"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Referencia"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Distrito"
                  value={distrito}
                  onChange={e => setDistrito(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Productos</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={productoQuery}
              onChange={e => { setProductoQuery(e.target.value); buscarProductos(e.target.value) }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {productoSugerencias.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
                {productoSugerencias.map(p => (
                  <li key={p.id} onClick={() => agregarProducto(p)}
                    className="px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                    <div>
                      <span className="font-medium">{p.nombre}</span>
                      {p.categorias && <span className="text-gray-400 ml-2 text-xs">{p.categorias.nombre}</span>}
                    </div>
                    <span className="font-medium text-gray-900">
                      S/ {(tipoEntrega === 'delivery' && p.precio_delivery ? p.precio_delivery : p.precio).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Agrega productos al pedido</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="flex-1 text-sm text-gray-800">{item.nombre}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cambiarCantidad(idx, -1)}
                      className="w-7 h-7 rounded-full border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(idx, 1)}
                      className="w-7 h-7 rounded-full border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 flex items-center justify-center">+</button>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-20 text-right">S/ {item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descuento (S/)</label>
              <input
                type="number"
                min="0"
                value={descuento}
                onChange={e => setDescuento(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {tipoEntrega === 'delivery' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Delivery (S/)</label>
                <input
                  type="number"
                  min="0"
                  value={costoDelivery}
                  onChange={e => setCostoDelivery(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Método de pago</label>
              <select
                value={metodoPago}
                onChange={e => setMetodoPago(e.target.value as MetodoPago)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            placeholder="Observaciones (ej: sin cebolla, extra ají...)"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="border-t border-gray-100 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>S/ {subtotal.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Descuento</span><span>− S/ {descuento.toFixed(2)}</span>
              </div>
            )}
            {tipoEntrega === 'delivery' && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Delivery</span><span>S/ {costoDelivery.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-gray-900 pt-1">
              <span>Total</span><span>S/ {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={guardar}
            disabled={guardando || items.length === 0}
            className="w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {guardando ? 'Guardando...' : `Registrar pedido · S/ ${total.toFixed(2)}`}
          </button>
        </div>

      </div>
    </div>
  )
}
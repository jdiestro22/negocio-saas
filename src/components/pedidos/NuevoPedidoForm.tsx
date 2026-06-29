'use client'

import { useState, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, Producto, PedidoItem, MetodoPago } from '@/lib/types'

// -------------------------------------------------------
// Componente principal: Nuevo Pedido Rápido
// -------------------------------------------------------
export function NuevoPedidoForm({ empresaId }: { empresaId: string }) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  // Estado del pedido
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Partial<Cliente> | null>(null)
  const [clienteSugerencias, setClienteSugerencias] = useState<Partial<Cliente>[]>([])

  const [productoBusqueda, setProductoBusqueda] = useState('')
  const [productoSugerencias, setProductoSugerencias] = useState<Producto[]>([])
  const [items, setItems] = useState<PedidoItem[]>([])

  const [descuento, setDescuento] = useState(0)
  const [delivery, setDelivery] = useState(0)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [observaciones, setObservaciones] = useState('')
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------
  // Búsqueda de clientes con debounce
  // -------------------------------------------------------
  const buscarClientes = useCallback(async (q: string) => {
    if (q.length < 2) return setClienteSugerencias([])
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, direccion, referencia, distrito')
      .eq('empresa_id', empresaId)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
      .limit(6)
    setClienteSugerencias(data ?? [])
  }, [supabase, empresaId])

  // -------------------------------------------------------
  // Búsqueda de productos
  // -------------------------------------------------------
  const buscarProductos = useCallback(async (q: string) => {
    if (q.length < 1) return setProductoSugerencias([])
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio, precio_delivery, imagen_url, stock, tiene_stock, codigo')
      .eq('empresa_id', empresaId)
      .eq('es_activo', true)
      .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`)
      .limit(8)
    setProductoSugerencias(data ?? [])
  }, [supabase, empresaId])

  // -------------------------------------------------------
  // Agregar producto al pedido
  // -------------------------------------------------------
  const agregarProducto = (producto: Producto) => {
    setItems(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) {
        return prev.map(i => i.producto_id === producto.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio - i.descuento }
          : i
        )
      }
      return [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        precio: producto.precio,
        descuento: 0,
        subtotal: producto.precio,
        producto,
      }]
    })
    setProductoBusqueda('')
    setProductoSugerencias([])
  }

  const cambiarCantidad = (idx: number, cantidad: number) => {
    if (cantidad < 1) return eliminarItem(idx)
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, cantidad, subtotal: cantidad * it.precio - it.descuento }
      : it
    ))
  }

  const eliminarItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // -------------------------------------------------------
  // Totales
  // -------------------------------------------------------
  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0)
  const total = subtotal - descuento + delivery

  // -------------------------------------------------------
  // Guardar pedido
  // -------------------------------------------------------
  const guardar = () => {
    if (items.length === 0) return setError('Agrega al menos un producto')
    setError(null)

    startTransition(async () => {
      const { data: pedido, error: err } = await supabase
        .from('pedidos')
        .insert({
          empresa_id: empresaId,
          cliente_id: clienteSeleccionado?.id ?? null,
          cliente_nombre: clienteSeleccionado?.nombre ?? clienteBusqueda || null,
          cliente_telefono: clienteSeleccionado?.telefono ?? null,
          cliente_direccion: clienteSeleccionado?.direccion ?? null,
          cliente_referencia: clienteSeleccionado?.referencia ?? null,
          cliente_distrito: clienteSeleccionado?.distrito ?? null,
          subtotal,
          descuento,
          delivery,
          total,
          metodo_pago: metodoPago,
          estado: 'pendiente',
          observaciones: observaciones || null,
        })
        .select('id')
        .single()

      if (err || !pedido) return setError(err?.message ?? 'Error al guardar')

      // Insertar items
      await supabase.from('pedido_items').insert(
        items.map(i => ({
          empresa_id: empresaId,
          pedido_id: pedido.id,
          producto_id: i.producto_id,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          descuento: i.descuento,
          subtotal: i.subtotal,
        }))
      )

      // Resetear
      setItems([])
      setClienteSeleccionado(null)
      setClienteBusqueda('')
      setDescuento(0)
      setDelivery(0)
      setObservaciones('')
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    })
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {exito && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
          ✓ Pedido registrado exitosamente
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Cliente */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Cliente</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={clienteSeleccionado ? clienteSeleccionado.nombre : clienteBusqueda}
            onChange={e => {
              if (clienteSeleccionado) setClienteSeleccionado(null)
              setClienteBusqueda(e.target.value)
              buscarClientes(e.target.value)
            }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {clienteSugerencias.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
              {clienteSugerencias.map(c => (
                <li key={c.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                  onClick={() => { setClienteSeleccionado(c); setClienteSugerencias([]) }}
                >
                  <span className="font-medium">{c.nombre}</span>
                  {c.telefono && <span className="text-gray-400 ml-2">{c.telefono}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {clienteSeleccionado?.direccion && (
          <p className="text-xs text-gray-500 mt-2">📍 {clienteSeleccionado.direccion}
            {clienteSeleccionado.distrito && ` · ${clienteSeleccionado.distrito}`}
          </p>
        )}
      </section>

      {/* Productos */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Productos</h2>
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Buscar producto o código..."
            value={productoBusqueda}
            onChange={e => { setProductoBusqueda(e.target.value); buscarProductos(e.target.value) }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {productoSugerencias.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
              {productoSugerencias.map(p => (
                <li key={p.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex justify-between"
                  onClick={() => agregarProducto(p)}
                >
                  <span>{p.nombre}</span>
                  <span className="font-medium text-gray-900">S/ {p.precio.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Agrega productos al pedido</p>
        )}

        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <span className="flex-1 text-sm">{item.nombre}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => cambiarCantidad(idx, item.cantidad - 1)}
                className="w-6 h-6 rounded border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">−</button>
              <span className="w-8 text-center text-sm font-medium">{item.cantidad}</span>
              <button onClick={() => cambiarCantidad(idx, item.cantidad + 1)}
                className="w-6 h-6 rounded border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">+</button>
            </div>
            <span className="text-sm font-medium w-20 text-right">S/ {item.subtotal.toFixed(2)}</span>
            <button onClick={() => eliminarItem(idx)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}
      </section>

      {/* Totales y configuración */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descuento</label>
            <input type="number" min="0" value={descuento}
              onChange={e => setDescuento(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Delivery</label>
            <input type="number" min="0" value={delivery}
              onChange={e => setDelivery(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPago)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg">
              <option value="efectivo">Efectivo</option>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
        </div>

        <input type="text" placeholder="Observaciones (opcional)"
          value={observaciones} onChange={e => setObservaciones(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />

        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500">Subtotal: S/ {subtotal.toFixed(2)}</div>
            <div className="text-lg font-semibold text-gray-900">Total: S/ {total.toFixed(2)}</div>
          </div>
          <button onClick={guardar} disabled={isPending || items.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isPending ? 'Guardando...' : 'Registrar pedido'}
          </button>
        </div>
      </section>
    </div>
  )
}

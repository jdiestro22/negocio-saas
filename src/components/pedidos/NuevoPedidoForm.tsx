'use client'

import { useState, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, MetodoPago } from '@/lib/types'

type ClienteParcial = {
  id: string
  nombre: string
  telefono?: string | null
  direccion?: string | null
  referencia?: string | null
  distrito?: string | null
}

type ItemPedido = {
  producto_id: string | null
  nombre: string
  cantidad: number
  precio: number
  descuento: number
  subtotal: number
}

export function NuevoPedidoForm({ empresaId }: { empresaId: string }) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteParcial | null>(null)
  const [clienteSugerencias, setClienteSugerencias] = useState<ClienteParcial[]>([])

  const [productoBusqueda, setProductoBusqueda] = useState('')
  const [productoSugerencias, setProductoSugerencias] = useState<Producto[]>([])
  const [items, setItems] = useState<ItemPedido[]>([])

  const [descuento, setDescuento] = useState(0)
  const [delivery, setDelivery] = useState(0)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [observaciones, setObservaciones] = useState('')
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscarClientes = useCallback(async (q: string) => {
    if (q.length < 2) return setClienteSugerencias([])
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, direccion, referencia, distrito')
      .eq('empresa_id', empresaId)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
      .limit(6)
    setClienteSugerencias((data ?? []) as ClienteParcial[])
  }, [supabase, empresaId])

  const buscarProductos = useCallback(async (q: string) => {
    if (q.length < 1) return setProductoSugerencias([])
    const { data } = await supabase
      .from('productos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('es_activo', true)
      .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`)
      .limit(8)
    setProductoSugerencias((data ?? []) as Producto[])
  }, [supabase, empresaId])

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

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0)
  const total = subtotal - descuento + delivery

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
      </section>

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
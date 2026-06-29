'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  direccion: string | null
  referencia: string | null
  distrito: string | null
  observaciones: string | null
  total_comprado: number
  total_pedidos: number
  created_at: string
}

export default function ClientesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [verDetalle, setVerDetalle] = useState<Cliente | null>(null)

  // Formulario
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [distrito, setDistrito] = useState('')
  const [observaciones, setObservaciones] = useState('')
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
        cargarClientes(data.empresa_id)
      }
    }
    init()
  }, [])

  const cargarClientes = async (eid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, direccion, referencia, distrito, observaciones, total_comprado, total_pedidos, created_at')
      .eq('empresa_id', eid)
      .is('deleted_at', null)
      .order('nombre')
    setClientes((data ?? []) as Cliente[])
    setLoading(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono ?? '').includes(busqueda) ||
    (c.distrito ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => {
    setEditando(null)
    setNombre('')
    setTelefono('')
    setDireccion('')
    setReferencia('')
    setDistrito('')
    setObservaciones('')
    setError(null)
    setModalAbierto(true)
  }

  const abrirEditar = (c: Cliente) => {
    setEditando(c)
    setNombre(c.nombre)
    setTelefono(c.telefono ?? '')
    setDireccion(c.direccion ?? '')
    setReferencia(c.referencia ?? '')
    setDistrito(c.distrito ?? '')
    setObservaciones(c.observaciones ?? '')
    setError(null)
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    if (!empresaId) return
    setGuardando(true)
    setError(null)

    const datos = {
      empresa_id: empresaId,
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
      referencia: referencia.trim() || null,
      distrito: distrito.trim() || null,
      observaciones: observaciones.trim() || null,
    }

    if (editando) {
      await supabase.from('clientes').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('clientes').insert(datos)
    }

    setGuardando(false)
    setModalAbierto(false)
    cargarClientes(empresaId)
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (empresaId) cargarClientes(empresaId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Clientes</h1>
          <span className="text-sm text-gray-400">{clientes.length} registrados</span>
        </div>
        <button onClick={abrirNuevo}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <input type="text" placeholder="Buscar por nombre, teléfono o distrito..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      <div className="p-4 max-w-4xl mx-auto">
        {loading && (
          <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
        )}

        {!loading && clientesFiltrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 text-sm">No hay clientes registrados</p>
            <button onClick={abrirNuevo}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Agregar primer cliente
            </button>
          </div>
        )}

        <div className="space-y-2">
          {clientesFiltrados.map(c => (
            <div key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-medium text-sm">
                  {c.nombre.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{c.nombre}</span>
                  {c.distrito && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {c.distrito}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {c.telefono && (
                    <span className="text-xs text-gray-400">📞 {c.telefono}</span>
                  )}
                  {c.direccion && (
                    <span className="text-xs text-gray-400 truncate">📍 {c.direccion}</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900">
                  S/ {c.total_comprado.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">{c.total_pedidos} pedidos</div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <button onClick={() => setVerDetalle(c)}
                  className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100">
                  Ver
                </button>
                <button onClick={() => abrirEditar(c)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                  Editar
                </button>
                <button onClick={() => eliminar(c.id)}
                  className="text-xs px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nuevo/editar cliente */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-900">
                {editando ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre completo *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: María González"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Teléfono</label>
                <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
                  placeholder="Ej: 987654321"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Dirección</label>
                <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
                  placeholder="Ej: Jr. Las Flores 234"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Referencia</label>
                  <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                    placeholder="Ej: Frente al parque"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Distrito</label>
                  <input type="text" value={distrito} onChange={e => setDistrito(e.target.value)}
                    placeholder="Ej: Surco"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ej: Cliente frecuente, prefiere pago con Yape"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

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
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle cliente */}
      {verDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-900">Detalle del cliente</h2>
              <button onClick={() => setVerDetalle(null)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-xl">
                  {verDetalle.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">{verDetalle.nombre}</div>
                {verDetalle.telefono && (
                  <div className="text-sm text-gray-500">📞 {verDetalle.telefono}</div>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {verDetalle.direccion && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Dirección</div>
                  <div className="text-sm text-gray-700">{verDetalle.direccion}</div>
                  {verDetalle.referencia && (
                    <div className="text-xs text-gray-400">{verDetalle.referencia}</div>
                  )}
                </div>
              )}
              {verDetalle.distrito && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Distrito</div>
                  <div className="text-sm text-gray-700">{verDetalle.distrito}</div>
                </div>
              )}
              {verDetalle.observaciones && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Observaciones</div>
                  <div className="text-sm text-gray-700">{verDetalle.observaciones}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <div className="text-lg font-semibold text-green-700">
                  S/ {verDetalle.total_comprado.toFixed(2)}
                </div>
                <div className="text-xs text-green-600">Total comprado</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-lg font-semibold text-blue-700">
                  {verDetalle.total_pedidos}
                </div>
                <div className="text-xs text-blue-600">Pedidos realizados</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setVerDetalle(null); abrirEditar(verDetalle) }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                Editar
              </button>
              <button onClick={() => setVerDetalle(null)}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
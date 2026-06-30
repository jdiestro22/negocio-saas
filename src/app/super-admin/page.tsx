'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Empresa = {
  id: string
  nombre: string
  tipo_negocio: string | null
  estado: string
  created_at: string
  plan_id: string | null
  fecha_vencimiento: string | null
}

type Plan = {
  id: string
  nombre: string
}

export default function SuperAdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<Empresa | null>(null)
  const [modalRenovar, setModalRenovar] = useState(false)
  const [empresaRenovar, setEmpresaRenovar] = useState<Empresa | null>(null)
  const [diasRenovacion, setDiasRenovacion] = useState('30')
    
  // Formulario empresa
  const [empNombre, setEmpNombre] = useState('')
  const [empTipo, setEmpTipo] = useState('Restaurante')
  const [empPlan, setEmpPlan] = useState('')

  // Formulario usuario
  const [usrNombre, setUsrNombre] = useState('')
  const [usrEmail, setUsrEmail] = useState('')
  const [usrPassword, setUsrPassword] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('auth_user_id', user.id)
        .single()

      if (usuario?.rol !== 'super_admin') return router.push('/dashboard')

      cargarDatos()
    }
    init()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    const [{ data: emps }, { data: pls }] = await Promise.all([
      supabase.from('empresas').select('id, nombre, tipo_negocio, estado, created_at, plan_id, fecha_vencimiento').order('created_at', { ascending: false }),
      supabase.from('planes').select('id, nombre').order('orden'),
    ])
    setEmpresas((emps ?? []) as Empresa[])
    setPlanes((pls ?? []) as Plan[])
    if (pls && pls.length > 0) setEmpPlan(pls[0].id)
    setLoading(false)
  }

  const crearEmpresa = async () => {
    if (!empNombre.trim()) return setError('El nombre es obligatorio')
    setGuardando(true)
    setError(null)

    const { error: err } = await supabase.from('empresas').insert({
      nombre: empNombre.trim(),
      tipo_negocio: empTipo,
      plan_id: empPlan || null,
      estado: 'activa',
      moneda: 'PEN',
      simbolo_moneda: 'S/',
      fecha_inicio: new Date().toISOString().split('T')[0],
    })

    if (err) {
      setError(err.message)
      setGuardando(false)
      return
    }

    setGuardando(false)
    setModalEmpresa(false)
    setEmpNombre('')
    setExito('Empresa creada correctamente')
    setTimeout(() => setExito(null), 3000)
    cargarDatos()
  }

  const abrirModalUsuario = (empresa: Empresa) => {
    setEmpresaSeleccionada(empresa)
    setUsrNombre('')
    setUsrEmail('')
    setUsrPassword('')
    setError(null)
    setModalUsuario(true)
  }

  const crearUsuario = async () => {
    if (!usrNombre.trim()) return setError('El nombre es obligatorio')
    if (!usrEmail.trim()) return setError('El email es obligatorio')
    if (!usrPassword || usrPassword.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (!empresaSeleccionada) return
    setGuardando(true)
    setError(null)

    // Crear usuario en Supabase Auth usando la API admin
    const response = await fetch('/api/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: usrEmail,
        password: usrPassword,
        nombre: usrNombre,
        empresa_id: empresaSeleccionada.id,
        rol: 'admin_empresa',
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error ?? 'Error al crear usuario')
      setGuardando(false)
      return
    }

    setGuardando(false)
    setModalUsuario(false)
    setExito(`Usuario ${usrNombre} creado correctamente`)
    setTimeout(() => setExito(null), 4000)
  }

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from('empresas').update({ estado }).eq('id', id)
    cargarDatos()
  }

  const abrirModalRenovar = (empresa: Empresa) => {
  setEmpresaRenovar(empresa)
  setDiasRenovacion('30')
  setModalRenovar(true)
  }

  const renovarLicencia = async () => {
  if (!empresaRenovar) return
  setGuardando(true)

  const dias = Number(diasRenovacion) || 30
  const hoy = new Date()
  const nuevaFecha = new Date(hoy.setDate(hoy.getDate() + dias))

  await supabase
    .from('empresas')
    .update({
      fecha_vencimiento: nuevaFecha.toISOString().split('T')[0],
      estado: 'activa',
    })
    .eq('id', empresaRenovar.id)

  // Registrar el pago en el historial
  await supabase.from('pagos').insert({
    empresa_id: empresaRenovar.id,
    monto: 0,
    metodo: 'transferencia',
    fecha_pago: new Date().toISOString().split('T')[0],
    notas: `Renovación de ${dias} días`,
  })

  setGuardando(false)
  setModalRenovar(false)
  setExito(`Licencia de ${empresaRenovar.nombre} renovada hasta ${nuevaFecha.toLocaleDateString('es-PE')}`)
  setTimeout(() => setExito(null), 4000)
  cargarDatos()
  }

  const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
    activa:     { label: 'Activa',      color: '#1D9E75', bg: '#D4F5E9' },
    prueba:     { label: 'Prueba',      color: '#EF9F27', bg: '#FEF3CD' },
    suspendida: { label: 'Suspendida',  color: '#E24B4A', bg: '#FDEAEA' },
    vencida:    { label: 'Vencida',     color: '#888780', bg: '#F3F3F2' },
  }

  const TIPOS = ['Restaurante', 'Pollería', 'Fast Food', 'Bodega', 'Ferretería', 'Farmacia', 'Tienda', 'Barbería', 'Pastelería', 'Minimarket', 'Veterinaria', 'Taller', 'Otro']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">←</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Super Admin</h1>
            <p className="text-xs text-gray-400">{empresas.length} empresas registradas</p>
          </div>
        </div>
        <button onClick={() => { setError(null); setModalEmpresa(true) }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          + Nueva empresa
        </button>
      </div>

      {exito && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          ✓ {exito}
        </div>
      )}

      {/* Lista de empresas */}
      <div className="p-4 max-w-5xl mx-auto">
        {loading && <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>}

        <div className="space-y-3">
          {empresas.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{e.nombre}</span>
                    <span style={{ background: ESTADOS[e.estado]?.bg, color: ESTADOS[e.estado]?.color }}
                      className="text-xs font-medium px-2 py-0.5 rounded-full">
                      {ESTADOS[e.estado]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                     {e.tipo_negocio && <span className="text-xs text-gray-400">{e.tipo_negocio}</span>}
                     <span className="text-xs text-gray-300">·</span>
                     <span className="text-xs text-gray-400">
                     Creada {new Date(e.created_at).toLocaleDateString('es-PE')}
                     </span>
                     {e.fecha_vencimiento && (
                     <>
                     <span className="text-xs text-gray-300">·</span>
                     <span className={`text-xs ${
                     new Date(e.fecha_vencimiento) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
                     }`}>
                     Vence {new Date(e.fecha_vencimiento).toLocaleDateString('es-PE')}
                     </span>
                     </>
                    )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => abrirModalRenovar(e)}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                    Renovar
                  </button>
                  <button onClick={() => abrirModalUsuario(e)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                    + Usuario
                  </button>
                  {e.estado === 'activa' ? (
                    <button onClick={() => cambiarEstado(e.id, 'suspendida')}
                      className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                      Suspender
                    </button>
                  ) : (
                    <button onClick={() => cambiarEstado(e.id, 'activa')}
                      className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                      Activar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nueva empresa */}
      {modalEmpresa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-900">Nueva empresa</h2>
              <button onClick={() => setModalEmpresa(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre de la empresa *</label>
                <input type="text" value={empNombre} onChange={e => setEmpNombre(e.target.value)}
                  placeholder="Ej: Pollería El Rey"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo de negocio</label>
                <select value={empTipo} onChange={e => setEmpTipo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plan</label>
                <select value={empPlan} onChange={e => setEmpPlan(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEmpresa(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={crearEmpresa} disabled={guardando}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {guardando ? 'Creando...' : 'Crear empresa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {modalUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">Nuevo usuario</h2>
              <button onClick={() => setModalUsuario(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-5">Empresa: {empresaSeleccionada?.nombre}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre completo *</label>
                <input type="text" value={usrNombre} onChange={e => setUsrNombre(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email *</label>
                <input type="email" value={usrEmail} onChange={e => setUsrEmail(e.target.value)}
                  placeholder="carlos@mirestaurante.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Contraseña *</label>
                <input type="password" value={usrPassword} onChange={e => setUsrPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{error}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalUsuario(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={crearUsuario} disabled={guardando}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
{guardando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal renovar licencia */}
      {modalRenovar && empresaRenovar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">Renovar licencia</h2>
              <button onClick={() => setModalRenovar(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-5">{empresaRenovar.nombre}</p>

            {empresaRenovar.fecha_vencimiento && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
                Vencimiento actual: {new Date(empresaRenovar.fecha_vencimiento).toLocaleDateString('es-PE')}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Extender por (días)</label>
                <div className="flex gap-2">
                  {['30', '90', '180', '365'].map(d => (
                    <button key={d} onClick={() => setDiasRenovacion(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        diasRenovacion === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                Nueva fecha de vencimiento: {
                  new Date(new Date().setDate(new Date().getDate() + Number(diasRenovacion || 30)))
                    .toLocaleDateString('es-PE')
                }
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalRenovar(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={renovarLicencia} disabled={guardando}
                  className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {guardando ? 'Renovando...' : 'Confirmar renovación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
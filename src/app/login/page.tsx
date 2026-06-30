'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setAviso(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Verificar el estado de la empresa
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id, rol, empresas(nombre, estado, fecha_vencimiento)')
      .eq('auth_user_id', authData.user.id)
      .single()

    // Super admin no tiene empresa, siempre puede entrar
    if (!usuario?.empresa_id) {
      router.push('/dashboard')
      return
    }

    const empresa = usuario.empresas as any

    if (empresa?.fecha_vencimiento) {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const vencimiento = new Date(empresa.fecha_vencimiento)
      const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

      // Si ya venció, bloquear el acceso
      if (diasRestantes < 0 || empresa.estado === 'vencida') {
        await supabase.auth.signOut()
        setError(`Tu suscripción venció el ${vencimiento.toLocaleDateString('es-PE')}. Contacta al administrador para renovar tu plan.`)
        setLoading(false)
        return
      }

      // Si la empresa está suspendida manualmente
      if (empresa.estado === 'suspendida') {
        await supabase.auth.signOut()
        setError('Tu cuenta está suspendida. Contacta al administrador.')
        setLoading(false)
        return
      }

      // Si faltan 3 días o menos, mostrar aviso (pero deja entrar)
      if (diasRestantes <= 3 && diasRestantes >= 0) {
        setAviso(
          diasRestantes === 0
            ? 'Tu suscripción vence hoy. Renueva pronto para evitar interrupciones.'
            : `Tu suscripción vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}. Renueva pronto.`
        )
      }
    }

    setLoading(false)
    setTimeout(() => router.push('/dashboard'), aviso ? 2500 : 0)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-white text-lg">N</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Bienvenido</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresa a tu cuenta</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {aviso && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg p-3 mb-4">
            ⚠ {aviso}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}
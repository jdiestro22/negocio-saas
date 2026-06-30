import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const rutasProtegidas = ['/dashboard', '/pedidos', '/productos', '/clientes', '/super-admin', '/reportes']
  const estaEnRutaProtegida = rutasProtegidas.some(r => request.nextUrl.pathname.startsWith(r))

  if (!user && estaEnRutaProtegida) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Validar vencimiento de licencia en cada navegación
  if (user && estaEnRutaProtegida) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id, empresas(estado, fecha_vencimiento)')
      .eq('auth_user_id', user.id)
      .single()

    if (usuario?.empresa_id) {
      const empresa = usuario.empresas as any
      if (empresa?.fecha_vencimiento) {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const vencimiento = new Date(empresa.fecha_vencimiento)
        const vencida = vencimiento.getTime() < hoy.getTime()

        if (vencida || empresa.estado === 'vencida' || empresa.estado === 'suspendida') {
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?vencido=1', request.url))
        }
      }
    }
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)).*)'],
}
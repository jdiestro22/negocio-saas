import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, nombre, empresa_id, rol } = await request.json()

    // Cliente con service role para crear usuarios
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Crear en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 400 })
    }

    // Insertar en tabla usuarios
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      auth_user_id: authData.user.id,
      empresa_id,
      nombre,
      email,
      rol: rol ?? 'admin_empresa',
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
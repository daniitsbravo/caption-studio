import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CaptionUpdate } from '@/types/database'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { caption?: string; hashtags?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const patch: CaptionUpdate = { updated_at: new Date().toISOString() }
  if (typeof body.caption === 'string') patch.caption = body.caption
  if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags

  const { data, error } = await supabase
    .from('captions')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, caption, hashtags, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('captions')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

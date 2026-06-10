import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  CAROUSEL_SYSTEM_PROMPT,
  CLAUDE_MODEL,
  getAnthropicClient,
  isAllowedMediaType,
  parseClaudeJson,
} from '@/lib/anthropic'

export const maxDuration = 60

interface GenerateCaptionGroupBody {
  images: { base64: string; mediaType: string }[]
  groupTitle: string
  imageUrls: string[]
  /** Si se envía, actualiza esa fila en vez de crear una nueva (regenerar) */
  existingId?: string
}

interface CaptionPayload {
  caption: string
  hashtags: string[]
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: GenerateCaptionGroupBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { images, groupTitle, imageUrls, existingId } = body

  if (!images?.length || !imageUrls?.length) {
    return NextResponse.json(
      { error: 'Faltan imágenes o URLs del grupo' },
      { status: 400 }
    )
  }

  if (images.length > 10) {
    return NextResponse.json({ error: 'Máximo 10 imágenes por grupo' }, { status: 400 })
  }

  for (const img of images) {
    if (!isAllowedMediaType(img.mediaType)) {
      return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
    }
  }

  try {
    const anthropic = getAnthropicClient()

    const content: Anthropic.ContentBlockParam[] = images.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: img.base64,
      },
    }))

    content.push({
      type: 'text' as const,
      text: `Estas fotos forman un carrusel de Instagram titulado "${groupTitle}". Genera el caption y los hashtags.`,
    })

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: CAROUSEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('La IA no devolvió texto')
    }

    const payload = parseClaudeJson<CaptionPayload>(textBlock.text)

    if (existingId) {
      const { data, error } = await supabase
        .from('captions')
        .update({
          caption: payload.caption,
          hashtags: payload.hashtags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (error) throw error
      return NextResponse.json({ ...payload, id: data.id })
    }

    const { data, error } = await supabase
      .from('captions')
      .insert({
        user_id: user.id,
        image_url: imageUrls[0],
        image_name: groupTitle,
        caption: payload.caption,
        hashtags: payload.hashtags,
        is_carousel: true,
        carousel_image_urls: imageUrls,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ ...payload, id: data.id })
  } catch (err) {
    console.error('generate-caption-group error:', err)
    const message = err instanceof Error ? err.message : 'Error generando el caption del grupo'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  CAPTION_SYSTEM_PROMPT,
  CLAUDE_MODEL,
  getAnthropicClient,
  isAllowedMediaType,
  parseClaudeJson,
} from '@/lib/anthropic'

export const maxDuration = 60

interface GenerateCaptionBody {
  imageBase64: string
  mediaType: string
  imageName: string
  imageUrl: string
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

  let body: GenerateCaptionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { imageBase64, mediaType, imageName, imageUrl, existingId } = body

  if (!imageBase64 || !mediaType || !imageUrl) {
    return NextResponse.json(
      { error: 'Faltan campos: imageBase64, mediaType, imageUrl' },
      { status: 400 }
    )
  }

  if (!isAllowedMediaType(mediaType)) {
    return NextResponse.json(
      { error: 'Formato no soportado. Usa JPG, PNG o WEBP' },
      { status: 400 }
    )
  }

  try {
    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: CAPTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Analiza esta fotografía y genera el caption y los hashtags para Instagram.',
            },
          ],
        },
      ],
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
        image_url: imageUrl,
        image_name: imageName ?? null,
        caption: payload.caption,
        hashtags: payload.hashtags,
        is_carousel: false,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ ...payload, id: data.id })
  } catch (err) {
    console.error('generate-caption error:', err)
    const message = err instanceof Error ? err.message : 'Error generando el caption'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

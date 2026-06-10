import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  CLAUDE_MODEL,
  GROUPING_SYSTEM_PROMPT,
  getAnthropicClient,
  isAllowedMediaType,
  parseClaudeJson,
} from '@/lib/anthropic'

export const maxDuration = 60

interface GroupImagesBody {
  images: {
    id: string
    base64: string
    mediaType: string
    name: string
  }[]
}

interface GroupsPayload {
  groups: {
    group_id: string
    title: string
    rationale: string
    image_ids: string[]
    cover_image_id: string
  }[]
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: GroupImagesBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.images?.length) {
    return NextResponse.json({ error: 'No se recibieron imágenes' }, { status: 400 })
  }

  if (body.images.length > 10) {
    return NextResponse.json(
      { error: 'Máximo 10 imágenes por sesión' },
      { status: 400 }
    )
  }

  for (const img of body.images) {
    if (!isAllowedMediaType(img.mediaType)) {
      return NextResponse.json(
        { error: `Formato no soportado en ${img.name}` },
        { status: 400 }
      )
    }
  }

  try {
    const anthropic = getAnthropicClient()

    // Todas las imágenes en un solo mensaje, cada una precedida de su id
    const content: Anthropic.ContentBlockParam[] = body.images.flatMap((img) => [
      {
        type: 'text' as const,
        text: `Imagen con id "${img.id}" (archivo: ${img.name}):`,
      },
      {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
          data: img.base64,
        },
      },
    ])

    content.push({
      type: 'text' as const,
      text: 'Agrupa estas fotografías en posts de Instagram. Usa exactamente los ids indicados en image_ids.',
    })

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: GROUPING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('La IA no devolvió texto')
    }

    const payload = parseClaudeJson<GroupsPayload>(textBlock.text)

    // Filtra ids inventados por la IA y descarta grupos vacíos
    const validIds = new Set(body.images.map((i) => i.id))
    const groups = payload.groups
      .map((g) => ({
        ...g,
        image_ids: g.image_ids.filter((id) => validIds.has(id)),
      }))
      .filter((g) => g.image_ids.length > 0)
      .map((g) => ({
        ...g,
        cover_image_id: validIds.has(g.cover_image_id)
          ? g.cover_image_id
          : g.image_ids[0],
      }))

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('group-images error:', err)
    const message = err instanceof Error ? err.message : 'Error agrupando las imágenes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

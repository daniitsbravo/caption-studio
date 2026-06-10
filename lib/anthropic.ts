import Anthropic from '@anthropic-ai/sdk'

// AVISO: claude-sonnet-4-20250514 está deprecado y se retira el 15/06/2026.
// Cambia a "claude-sonnet-4-6" vía la variable de entorno CLAUDE_MODEL.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514'

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada en el servidor')
  }
  return new Anthropic({ apiKey })
}

export const CAPTION_SYSTEM_PROMPT = `Eres un experto en marketing digital para el sector de arquitectura y construcción en España. Analiza la fotografía y genera contenido para Instagram.
Responde SOLO con JSON válido sin backticks ni texto adicional:
{"caption": "...", "hashtags": ["...", "..."]}

Reglas caption: español, tono cercano y conversacional, 3-6 frases, orientado a arquitectos y constructoras, destaca diseño/funcionalidad/estética, puede incluir pregunta de engagement al final, máximo 3 emojis.
Reglas hashtags: 15-20 hashtags, mezcla español/inglés, sector arquitectura construcción diseño, algunos de tendencia.`

export const CAROUSEL_SYSTEM_PROMPT = `${CAPTION_SYSTEM_PROMPT}

Se te proporcionan VARIAS fotos que forman un carrusel de Instagram.
Genera un caption que englobe todas las imágenes como una narrativa
cohesionada. Menciona la variedad visual si es relevante.`

export const GROUPING_SYSTEM_PROMPT = `Eres un experto en fotografía de arquitectura y construcción.
Recibes un conjunto de fotografías. Agrúpalas en posts para Instagram
según similitud visual y temática: mismo espacio, misma obra, misma
atmósfera o luz, o que narrativamente tengan sentido juntas.

Cada grupo representa un post de Instagram (carrusel de 2-10 fotos
o foto individual). Agrupa con criterio editorial como un director de arte.

Responde SOLO con JSON válido sin backticks:
{
  "groups": [
    {
      "group_id": "g1",
      "title": "título descriptivo breve",
      "rationale": "explicación breve de por qué estas fotos van juntas",
      "image_ids": ["id1", "id2"],
      "cover_image_id": "id1"
    }
  ]
}`

/**
 * Extrae y parsea el JSON de la respuesta de Claude, tolerando
 * backticks o texto adicional aunque el prompt los prohíba.
 */
export function parseClaudeJson<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T
    }
    throw new Error('La respuesta de la IA no contiene JSON válido')
  }
}

export type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

export function isAllowedMediaType(mediaType: string): mediaType is AllowedMediaType {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)
}

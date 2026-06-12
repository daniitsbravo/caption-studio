#!/usr/bin/env node
/**
 * CaptionStudio — procesador por lotes
 *
 * Apunta a una carpeta de tu Mac con fotos (cientos o miles) y él solo:
 *   1. Evalúa todas las fotos con IA (calidad, contenido, etiquetas) por tandas
 *   2. Selecciona las mejores y las agrupa en posts con criterio editorial
 *      (la agrupación usa las descripciones en texto: una sola llamada ve TODO)
 *   3. Sube las elegidas a Supabase Storage y genera el caption de cada post
 *   4. Guarda todo en la tabla captions → aparece en el Historial de la web
 *
 * Uso:
 *   node scripts/batch.mjs --dir "/ruta/a/fotos" [opciones]
 *
 * Opciones:
 *   --dir <ruta>       Carpeta con las fotos (obligatorio; busca también en subcarpetas)
 *   --posts <n>        Máximo de posts a generar (defecto: 8)
 *   --limit <n>        Procesar solo las primeras n fotos (útil para probar)
 *   --email <email>    Cuenta de CaptionStudio (defecto: usuario de prueba)
 *   --password <pass>  Contraseña de esa cuenta
 *   --tema <tema>      Sector/tipo de sesión (defecto: "arquitectura y construcción";
 *                      p. ej. "bodas", "interiorismo", "gastronomía")
 *   --dry-run          Evalúa y agrupa pero NO sube nada ni genera captions
 */

import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------- configuración ----------

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

function loadEnv() {
  const env = {}
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnv()
const MODEL = env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const EVAL_BATCH_SIZE = 6 // fotos por llamada en el pase de evaluación
const EVAL_CONCURRENCY = 3 // llamadas de evaluación en paralelo
const RESIZE_PX = 1200 // lado máximo al redimensionar
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic'])

const args = parseArgs(process.argv.slice(2))
if (!args.dir) {
  console.error('Falta --dir. Uso: node scripts/batch.mjs --dir "/ruta/a/fotos"')
  process.exit(1)
}

const MAX_POSTS = Number(args.posts ?? 8)
const EMAIL = args.email ?? env.CAPTIONSTUDIO_EMAIL
const PASSWORD = args.password ?? env.CAPTIONSTUDIO_PASSWORD

if (!args.dryRun && (!EMAIL || !PASSWORD)) {
  console.error(
    'Faltan credenciales: pasa --email/--password o define CAPTIONSTUDIO_EMAIL y CAPTIONSTUDIO_PASSWORD en .env.local'
  )
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TEMA = args.tema ?? 'arquitectura y construcción'
const ES_ARQUITECTURA = !args.tema

// Mantener la variante por defecto en sincronía con lib/anthropic.ts
const CAPTION_SYSTEM_PROMPT = `Eres un experto en marketing digital para el sector de ${TEMA} en España. Analiza la fotografía y genera contenido para Instagram.
Responde SOLO con JSON válido sin backticks ni texto adicional:
{"caption": "...", "hashtags": ["...", "..."]}

Reglas caption: español, tono cercano y conversacional, 3-6 frases, ${
  ES_ARQUITECTURA
    ? 'orientado a arquitectos y constructoras, destaca diseño/funcionalidad/estética'
    : `orientado al público de ${TEMA}, destaca la emoción y lo que hace especial cada imagen`
}, puede incluir pregunta de engagement al final, máximo 3 emojis.
Reglas hashtags: 15-20 hashtags, mezcla español/inglés, sector ${TEMA}, algunos de tendencia.`

const CAROUSEL_SYSTEM_PROMPT = `${CAPTION_SYSTEM_PROMPT}

Se te proporcionan VARIAS fotos que forman un carrusel de Instagram.
Genera un caption que englobe todas las imágenes como una narrativa
cohesionada. Menciona la variedad visual si es relevante.`

const EVAL_SYSTEM_PROMPT = `Eres un editor fotográfico experto en ${TEMA} que cura contenido para Instagram.
Recibes varias fotografías, cada una precedida de su id. Evalúa cada una.

Responde SOLO con JSON válido sin backticks:
{"fotos": [{"id": "...", "puntuacion": 0-10, "descripcion": "1-2 frases: qué se ve, escena, ambiente, luz, encuadre", "etiquetas": ["..."], "apta": true/false}]}

Criterios de puntuación: composición, luz, interés visual para Instagram, relevancia para ${TEMA}.
"apta" = false para fotos borrosas, mal expuestas, redundantes con poca calidad, accidentales o irrelevantes.
Sé exigente: en un porfolio profesional solo destacan las mejores.`

const GROUPING_TEXT_SYSTEM_PROMPT = `Eres un director de arte que planifica el feed de Instagram de una empresa de fotografía especializada en ${TEMA} en España.

Recibes el inventario de una sesión: lista de fotos con id, puntuación de calidad (0-10), descripción y etiquetas. NO ves las imágenes: trabaja con las descripciones.

Tu trabajo:
1. SELECCIONA solo las mejores fotos (prioriza puntuación alta y variedad; descarta las flojas y las redundantes)
2. AGRÚPALAS en posts: carruseles de 2-10 fotos que compartan espacio, obra, atmósfera o narrativa, o fotos individuales si son potentes por sí solas
3. Ordena los grupos del más fuerte al más débil

Responde SOLO con JSON válido sin backticks:
{"groups": [{"group_id": "g1", "title": "título breve", "rationale": "por qué estas fotos van juntas y por qué se eligieron", "image_ids": ["id1", "id2"], "cover_image_id": "id1"}]}`

// ---------- utilidades ----------

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true
    else if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i]
  }
  return out
}

function parseClaudeJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const s = cleaned.indexOf('{')
    const e = cleaned.lastIndexOf('}')
    if (s !== -1 && e > s) return JSON.parse(cleaned.slice(s, e + 1))
    throw new Error('Respuesta sin JSON válido')
  }
}

function findImages(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...findImages(full))
    else if (EXTENSIONS.has(extname(entry).toLowerCase())) out.push(full)
  }
  return out.sort()
}

/** Redimensiona con sips (nativo de macOS) y devuelve base64 jpeg */
function resizeToJpegBase64(srcPath, tmpDir, id) {
  const dst = join(tmpDir, `${id}.jpg`)
  execFileSync(
    'sips',
    ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', String(RESIZE_PX), srcPath, '--out', dst],
    { stdio: 'pipe' }
  )
  return readFileSync(dst).toString('base64')
}

async function callClaude(system, content, maxTokens) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  })
  const block = res.content.find((b) => b.type === 'text')
  if (!block) throw new Error('La IA no devolvió texto')
  return parseClaudeJson(block.text)
}

async function pool(items, size, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return results
}

// ---------- pipeline ----------

console.log(`\n📁 Escaneando ${args.dir} …`)
let files = findImages(args.dir)
if (args.limit) files = files.slice(0, Number(args.limit))
if (!files.length) {
  console.error('No se encontraron imágenes (jpg/png/webp/heic) en esa carpeta.')
  process.exit(1)
}
console.log(`   ${files.length} fotos encontradas`)

const tmpDir = mkdtempSync(join(tmpdir(), 'captionstudio-'))
const photos = new Map() // id → { file, base64 }

console.log(`\n🖼  Redimensionando a ${RESIZE_PX}px …`)
let resized = 0
for (let i = 0; i < files.length; i++) {
  const id = `f${String(i + 1).padStart(4, '0')}`
  try {
    photos.set(id, { file: files[i], base64: resizeToJpegBase64(files[i], tmpDir, id) })
    resized++
  } catch {
    console.warn(`   ⚠ no se pudo procesar ${basename(files[i])} (omitida)`)
  }
  if (resized % 100 === 0 && resized > 0) console.log(`   ${resized}/${files.length}`)
}
console.log(`   ${resized} fotos listas`)

// Etapa 1: evaluación por tandas
const ids = [...photos.keys()]
const batches = []
for (let i = 0; i < ids.length; i += EVAL_BATCH_SIZE) {
  batches.push(ids.slice(i, i + EVAL_BATCH_SIZE))
}

console.log(`\n🔍 Evaluando ${ids.length} fotos en ${batches.length} tandas (modelo: ${MODEL}) …`)
const evaluations = new Map() // id → {puntuacion, descripcion, etiquetas, apta}
let done = 0

await pool(batches, EVAL_CONCURRENCY, async (batch) => {
  const content = batch.flatMap((id) => [
    { type: 'text', text: `Foto con id "${id}":` },
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: photos.get(id).base64 },
    },
  ])
  content.push({ type: 'text', text: 'Evalúa estas fotos usando exactamente los ids indicados.' })

  try {
    const result = await callClaude(EVAL_SYSTEM_PROMPT, content, 2048)
    for (const f of result.fotos ?? []) {
      if (photos.has(f.id)) evaluations.set(f.id, f)
    }
  } catch (err) {
    console.warn(`   ⚠ tanda fallida (${batch.length} fotos omitidas): ${err.message}`)
  }
  done += batch.length
  process.stdout.write(`   ${Math.min(done, ids.length)}/${ids.length}\r`)
})

const aptas = [...evaluations.values()].filter((f) => f.apta)
console.log(`\n   ${evaluations.size} evaluadas · ${aptas.length} aptas para Instagram`)

if (!aptas.length) {
  console.error('Ninguna foto superó el filtro de calidad. Nada que publicar.')
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(0)
}

// Etapa 2: selección + agrupación (sobre texto, ve todo el inventario de una vez)
console.log(`\n🗂  Agrupando con criterio editorial (máx. ${MAX_POSTS} posts) …`)
const inventory = aptas
  .sort((a, b) => b.puntuacion - a.puntuacion)
  .map((f) => `- ${f.id} [${f.puntuacion}/10] ${f.descripcion} (${(f.etiquetas ?? []).join(', ')})`)
  .join('\n')

const groupingResult = await callClaude(
  GROUPING_TEXT_SYSTEM_PROMPT,
  [
    {
      type: 'text',
      text: `Inventario de la sesión (${aptas.length} fotos aptas):\n${inventory}\n\nGenera como máximo ${MAX_POSTS} posts con las mejores. Usa exactamente los ids del inventario.`,
    },
  ],
  4096
)

const groups = (groupingResult.groups ?? [])
  .map((g) => ({ ...g, image_ids: g.image_ids.filter((id) => photos.has(id)) }))
  .filter((g) => g.image_ids.length > 0)
  .slice(0, MAX_POSTS)

console.log(`   ${groups.length} posts propuestos:`)
for (const g of groups) {
  console.log(`   · "${g.title}" (${g.image_ids.length} foto${g.image_ids.length > 1 ? 's' : ''}) — ${g.rationale}`)
}

if (args.dryRun) {
  console.log('\n--dry-run: no se sube nada ni se generan captions. Fin.')
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(0)
}

// Etapa 3: login, subida y captions
console.log(`\n🔐 Iniciando sesión como ${EMAIL} …`)
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (authError) {
  console.error('Login fallido:', authError.message)
  process.exit(1)
}
const userId = auth.user.id

console.log(`\n✍️  Generando captions y guardando …`)
let okCount = 0

for (const group of groups) {
  try {
    // Subir las fotos del grupo a Storage
    const urls = []
    for (const id of group.image_ids) {
      const { file, base64 } = photos.get(id)
      const path = `${userId}/${Date.now()}-${id}-${basename(file).replace(/[^a-zA-Z0-9._-]/g, '-')}.jpg`
      const { error: upErr } = await supabase.storage
        .from('caption-images')
        .upload(path, Buffer.from(base64, 'base64'), { contentType: 'image/jpeg' })
      if (upErr) throw new Error(`subida: ${upErr.message}`)
      urls.push(
        supabase.storage.from('caption-images').getPublicUrl(path).data.publicUrl
      )
    }

    // Caption con análisis visual completo del grupo
    const isCarousel = group.image_ids.length > 1
    const content = group.image_ids.map((id) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: photos.get(id).base64 },
    }))
    content.push({
      type: 'text',
      text: isCarousel
        ? `Estas fotos forman un carrusel de Instagram titulado "${group.title}". Genera el caption y los hashtags.`
        : 'Analiza esta fotografía y genera el caption y los hashtags para Instagram.',
    })

    const payload = await callClaude(
      isCarousel ? CAROUSEL_SYSTEM_PROMPT : CAPTION_SYSTEM_PROMPT,
      content,
      1024
    )

    const { error: insErr } = await supabase.from('captions').insert({
      user_id: userId,
      image_url: urls[0],
      image_name: group.title,
      caption: payload.caption,
      hashtags: payload.hashtags,
      is_carousel: isCarousel,
      carousel_image_urls: isCarousel ? urls : [],
    })
    if (insErr) throw new Error(`insert: ${insErr.message}`)

    okCount++
    console.log(`   ✓ "${group.title}" (${group.image_ids.length} fotos)`)
  } catch (err) {
    console.warn(`   ✗ "${group.title}": ${err.message}`)
  }
}

rmSync(tmpDir, { recursive: true, force: true })

console.log(`\n✅ ${okCount}/${groups.length} posts generados y guardados.`)
console.log(`   Revísalos en el Historial: https://caption-studio-eight.vercel.app/history\n`)

'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useStudioStore, type CaptionResult } from '@/lib/store'
import { buildCopyText, cn } from '@/lib/utils'

// TODO: Integración con Instagram API — añadir aquí un botón "Publicar en
// Instagram" que use la Graph API (content publishing) cuando esté disponible.

type SaveState = 'idle' | 'saving' | 'saved'

interface CaptionCardProps {
  result: CaptionResult
}

export default function CaptionCard({ result }: CaptionCardProps) {
  const updateResult = useStudioStore((s) => s.updateResult)
  const images = useStudioStore((s) => s.images)

  const [caption, setCaption] = useState(result.caption)
  const [hashtagsText, setHashtagsText] = useState(
    result.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  )
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [regenerating, setRegenerating] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const skipNextSave = useRef(true)

  // Auto-guardado con debounce de 1s
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    setSaveState('saving')
    clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const hashtags = hashtagsText
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean)

      try {
        const res = await fetch(`/api/captions/${result.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, hashtags }),
        })

        if (!res.ok) throw new Error()

        updateResult(result.id, { caption, hashtags })
        setSaveState('saved')
      } catch {
        setSaveState('idle')
        toast.error('No se pudo guardar el cambio')
      }
    }, 1000)

    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caption, hashtagsText])

  function handleCopy() {
    const hashtags = hashtagsText
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean)
    navigator.clipboard.writeText(buildCopyText(caption, hashtags))
    toast.success('Caption y hashtags copiados')
  }

  async function handleRegenerate() {
    const sourceImages = result.sourceImageIds
      .map((id) => images.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))

    if (!sourceImages.length) {
      toast.error(
        'Las imágenes originales ya no están en la sesión. Sube las fotos de nuevo para regenerar.'
      )
      return
    }

    setRegenerating(true)

    try {
      let res: Response

      if (result.isCarousel) {
        res = await fetch('/api/generate-caption-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: sourceImages.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
            groupTitle: result.groupTitle ?? result.imageName,
            imageUrls: result.imageUrls,
            existingId: result.id,
          }),
        })
      } else {
        const img = sourceImages[0]
        res = await fetch('/api/generate-caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: img.base64,
            mediaType: img.mediaType,
            imageName: img.name,
            imageUrl: img.url,
            existingId: result.id,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error regenerando')

      skipNextSave.current = true
      setCaption(data.caption)
      setHashtagsText(
        data.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      )
      updateResult(result.id, { caption: data.caption, hashtags: data.hashtags })
      setSaveState('saved')
      toast.success('Caption regenerado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error regenerando')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Miniaturas */}
        <div className="flex shrink-0 gap-2 overflow-x-auto sm:w-auto">
          {result.imageUrls.slice(0, 4).map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt={result.imageName}
              className={cn(
                'h-20 w-20 rounded-lg object-cover',
                result.isCarousel && i > 0 && 'hidden sm:block'
              )}
            />
          ))}
          {result.imageUrls.length > 4 && (
            <div className="hidden h-20 w-20 items-center justify-center rounded-lg bg-gray-light text-sm text-gray-dark sm:flex">
              +{result.imageUrls.length - 4}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{result.imageName}</span>
            {result.isCarousel && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white">
                Carrusel
              </span>
            )}
            <span
              className={cn(
                'ml-auto text-xs',
                saveState === 'saving' ? 'text-gray-dark' : 'text-green-700',
                saveState === 'idle' && 'invisible'
              )}
            >
              {saveState === 'saving' ? 'Guardando…' : 'Guardado'}
            </span>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="input resize-y"
            aria-label="Caption"
          />

          <textarea
            value={hashtagsText}
            onChange={(e) => setHashtagsText(e.target.value)}
            rows={2}
            className="input mt-2 resize-y text-gray-dark"
            aria-label="Hashtags"
            placeholder="#arquitectura #construccion…"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={handleCopy} className="btn-primary text-xs">
              Copiar todo
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-secondary text-xs"
            >
              {regenerating ? 'Regenerando…' : 'Regenerar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

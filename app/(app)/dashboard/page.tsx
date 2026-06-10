'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/store'
import UploadZone from '@/components/UploadZone'
import ImageGrid from '@/components/ImageGrid'
import ResultsPanel from '@/components/ResultsPanel'

export default function DashboardPage() {
  const router = useRouter()
  const images = useStudioStore((s) => s.images)
  const addResult = useStudioStore((s) => s.addResult)
  const setGroups = useStudioStore((s) => s.setGroups)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [grouping, setGrouping] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(images.map((i) => i.id)))
  }

  async function handleGenerate() {
    const targets = images.filter((i) => selected.has(i.id))
    if (!targets.length) {
      toast.error('Selecciona al menos una imagen del grid')
      return
    }

    setGenerating(true)
    setPendingCount(targets.length)

    let ok = 0
    for (const img of targets) {
      try {
        const res = await fetch('/api/generate-caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: img.base64,
            mediaType: img.mediaType,
            imageName: img.name,
            imageUrl: img.url,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error generando caption')

        addResult({
          id: data.id,
          caption: data.caption,
          hashtags: data.hashtags,
          imageUrls: [img.url],
          imageName: img.name,
          isCarousel: false,
          sourceImageIds: [img.id],
        })
        ok++
      } catch (err) {
        toast.error(
          `${img.name}: ${err instanceof Error ? err.message : 'error desconocido'}`
        )
      } finally {
        setPendingCount((c) => Math.max(0, c - 1))
      }
    }

    if (ok > 0) {
      toast.success(ok === 1 ? 'Caption generado' : `${ok} captions generados`)
      setSelected(new Set())
    }

    setGenerating(false)
    setPendingCount(0)
  }

  async function handleGroup() {
    if (images.length < 2) {
      toast.error('Sube al menos 2 imágenes para agrupar')
      return
    }

    setGrouping(true)

    try {
      const res = await fetch('/api/group-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map((i) => ({
            id: i.id,
            base64: i.base64,
            mediaType: i.mediaType,
            name: i.name,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error agrupando imágenes')

      if (!data.groups?.length) {
        toast.error('La IA no pudo formar grupos con estas fotos')
        return
      }

      setGroups(data.groups)
      router.push('/dashboard/groups')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error agrupando imágenes')
    } finally {
      setGrouping(false)
    }
  }

  const busy = generating || grouping

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-dark">
        Sube tus fotos de obra y genera captions listos para Instagram
      </p>

      <div className="mt-6 space-y-6">
        <UploadZone />

        {images.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={busy || selected.size === 0}
                className="btn-primary"
              >
                {generating
                  ? 'Generando…'
                  : `Generar captions${selected.size ? ` (${selected.size})` : ''}`}
              </button>

              <button onClick={handleGroup} disabled={busy} className="btn-secondary">
                {grouping ? 'Analizando fotos…' : 'Agrupar fotos con IA'}
              </button>

              <button
                onClick={selectAll}
                disabled={busy}
                className="ml-auto text-sm text-gray-dark underline-offset-2 hover:underline"
              >
                Seleccionar todas
              </button>
            </div>

            <ImageGrid selected={selected} onToggle={toggleSelect} />
          </>
        )}

        <ResultsPanel pendingCount={pendingCount} />
      </div>
    </div>
  )
}

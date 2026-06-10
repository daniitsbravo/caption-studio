'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useStudioStore, type SuggestedGroup } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function GroupsReviewPage() {
  const router = useRouter()
  const images = useStudioStore((s) => s.images)
  const groups = useStudioStore((s) => s.groups)
  const setGroups = useStudioStore((s) => s.setGroups)
  const updateGroup = useStudioStore((s) => s.updateGroup)
  const removeGroup = useStudioStore((s) => s.removeGroup)
  const addGroup = useStudioStore((s) => s.addGroup)
  const clearGroups = useStudioStore((s) => s.clearGroups)
  const addResult = useStudioStore((s) => s.addResult)

  const [approving, setApproving] = useState(false)
  const [progress, setProgress] = useState('')
  const [dragImageId, setDragImageId] = useState<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  // Sin grupos en memoria (p. ej. recarga de página) → volver al dashboard
  useEffect(() => {
    if (!groups.length && !approving) {
      router.replace('/dashboard')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imageById = new Map(images.map((i) => [i.id, i]))
  const assignedIds = new Set(groups.flatMap((g) => g.image_ids))
  const unassigned = images.filter((i) => !assignedIds.has(i.id))

  function removeFromGroup(groupId: string, imageId: string) {
    const group = groups.find((g) => g.group_id === groupId)
    if (!group) return
    updateGroup(groupId, { image_ids: group.image_ids.filter((id) => id !== imageId) })
  }

  function moveToGroup(targetGroupId: string, imageId: string) {
    setGroups(
      groups.map((g) => {
        if (g.group_id === targetGroupId) {
          return g.image_ids.includes(imageId)
            ? g
            : { ...g, image_ids: [...g.image_ids, imageId] }
        }
        return { ...g, image_ids: g.image_ids.filter((id) => id !== imageId) }
      })
    )
  }

  function handleCreateGroup() {
    const n = groups.length + 1
    addGroup({
      group_id: `manual-${Date.now()}`,
      title: `Grupo nuevo ${n}`,
      rationale: 'Grupo creado manualmente',
      image_ids: [],
      cover_image_id: '',
    })
  }

  async function handleApproveAll() {
    const validGroups = groups.filter((g) => g.image_ids.length > 0)
    if (!validGroups.length) {
      toast.error('No hay grupos con fotos para aprobar')
      return
    }

    setApproving(true)

    let ok = 0
    for (let i = 0; i < validGroups.length; i++) {
      const group = validGroups[i]
      setProgress(`Generando ${i + 1} de ${validGroups.length}: ${group.title}`)

      const groupImages = group.image_ids
        .map((id) => imageById.get(id))
        .filter((img): img is NonNullable<typeof img> => Boolean(img))

      if (!groupImages.length) continue

      try {
        const res = await fetch('/api/generate-caption-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: groupImages.map((img) => ({
              base64: img.base64,
              mediaType: img.mediaType,
            })),
            groupTitle: group.title,
            imageUrls: groupImages.map((img) => img.url),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error generando caption')

        addResult({
          id: data.id,
          caption: data.caption,
          hashtags: data.hashtags,
          imageUrls: groupImages.map((img) => img.url),
          imageName: group.title,
          isCarousel: groupImages.length > 1,
          sourceImageIds: group.image_ids,
          groupTitle: group.title,
        })
        ok++
      } catch (err) {
        toast.error(
          `${group.title}: ${err instanceof Error ? err.message : 'error desconocido'}`
        )
      }
    }

    setApproving(false)
    setProgress('')

    if (ok > 0) {
      toast.success(ok === 1 ? 'Caption generado' : `${ok} captions generados`)
      clearGroups()
      router.push('/dashboard')
    }
  }

  function handleCancel() {
    clearGroups()
    router.push('/dashboard')
  }

  function renderThumb(group: SuggestedGroup, imageId: string) {
    const img = imageById.get(imageId)
    if (!img) return null

    return (
      <div
        key={imageId}
        draggable={!approving}
        onDragStart={() => setDragImageId(imageId)}
        onDragEnd={() => {
          setDragImageId(null)
          setDragOverGroup(null)
        }}
        className="group/thumb relative shrink-0 cursor-grab active:cursor-grabbing"
      >
        <img
          src={img.url}
          alt={img.name}
          className="h-20 w-20 rounded-lg object-cover"
        />
        <button
          onClick={() => removeFromGroup(group.group_id, imageId)}
          className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white group-hover/thumb:flex"
          aria-label="Sacar del grupo"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Revisión de grupos</h1>
      <p className="mt-1 text-sm text-gray-dark">
        La IA ha agrupado tus fotos en posts. Ajusta los grupos arrastrando las
        miniaturas y aprueba para generar los captions.
      </p>

      <div className="mt-6 space-y-4">
        {groups.map((group) => (
          <div
            key={group.group_id}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverGroup(group.group_id)
            }}
            onDragLeave={() => setDragOverGroup(null)}
            onDrop={(e) => {
              e.preventDefault()
              if (dragImageId) moveToGroup(group.group_id, dragImageId)
              setDragOverGroup(null)
              setDragImageId(null)
            }}
            className={cn(
              'card p-4 transition-colors',
              dragOverGroup === group.group_id && 'border-ink bg-gray-light/50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <input
                value={group.title}
                onChange={(e) => updateGroup(group.group_id, { title: e.target.value })}
                className="w-full max-w-md rounded-md border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold hover:border-gray-mid focus:border-ink focus:outline-none"
                aria-label="Título del grupo"
              />
              <button
                onClick={() => removeGroup(group.group_id)}
                disabled={approving}
                className="btn-secondary shrink-0 px-3 py-1 text-xs"
              >
                Disolver grupo
              </button>
            </div>

            <p className="mt-1 px-1 text-xs text-gray-dark">{group.rationale}</p>

            <div className="mt-3 flex min-h-[88px] gap-2 overflow-x-auto rounded-lg p-1">
              {group.image_ids.length ? (
                group.image_ids.map((id) => renderThumb(group, id))
              ) : (
                <p className="self-center px-2 text-xs text-gray-dark/60">
                  Arrastra fotos aquí
                </p>
              )}
            </div>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div className="card border-dashed p-4">
            <h2 className="text-sm font-semibold text-gray-dark">
              Fotos sin grupo ({unassigned.length})
            </h2>
            <p className="mt-0.5 text-xs text-gray-dark/70">
              Arrástralas a un grupo para incluirlas
            </p>
            <div className="mt-3 flex gap-2 overflow-x-auto p-1">
              {unassigned.map((img) => (
                <div
                  key={img.id}
                  draggable={!approving}
                  onDragStart={() => setDragImageId(img.id)}
                  onDragEnd={() => {
                    setDragImageId(null)
                    setDragOverGroup(null)
                  }}
                  className="shrink-0 cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-20 w-20 rounded-lg object-cover opacity-80"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleCreateGroup} disabled={approving} className="btn-secondary">
          + Crear grupo nuevo
        </button>
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-gray-mid bg-gray-light py-4">
        <button onClick={handleApproveAll} disabled={approving} className="btn-primary">
          {approving ? progress || 'Generando…' : 'Aprobar todos los grupos y generar captions'}
        </button>
        <button onClick={handleCancel} disabled={approving} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </div>
  )
}

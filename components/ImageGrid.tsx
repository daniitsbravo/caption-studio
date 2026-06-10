'use client'

/* eslint-disable @next/next/no-img-element */
import { useStudioStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ImageGridProps {
  selected: Set<string>
  onToggle: (id: string) => void
}

export default function ImageGrid({ selected, onToggle }: ImageGridProps) {
  const images = useStudioStore((s) => s.images)
  const removeImage = useStudioStore((s) => s.removeImage)

  if (!images.length) return null

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {images.map((img) => {
        const isSelected = selected.has(img.id)
        return (
          <div key={img.id} className="group relative">
            <button
              onClick={() => onToggle(img.id)}
              className={cn(
                'block w-full overflow-hidden rounded-lg border-2 transition-all',
                isSelected
                  ? 'border-ink ring-2 ring-ink/20'
                  : 'border-transparent hover:border-gray-mid'
              )}
            >
              <img
                src={img.url}
                alt={img.name}
                className="aspect-square w-full object-cover"
              />
            </button>

            {isSelected && (
              <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-white">
                ✓
              </span>
            )}

            <button
              onClick={() => removeImage(img.id)}
              className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs text-white hover:bg-ink group-hover:flex"
              aria-label={`Quitar ${img.name}`}
            >
              ✕
            </button>

            <p className="mt-1 truncate text-xs text-gray-dark" title={img.name}>
              {img.name}
            </p>
          </div>
        )
      })}
    </div>
  )
}

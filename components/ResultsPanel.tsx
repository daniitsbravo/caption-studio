'use client'

import { useStudioStore } from '@/lib/store'
import CaptionCard from '@/components/CaptionCard'
import { CaptionCardSkeleton } from '@/components/Skeletons'

interface ResultsPanelProps {
  pendingCount: number
}

export default function ResultsPanel({ pendingCount }: ResultsPanelProps) {
  const results = useStudioStore((s) => s.results)

  if (!results.length && pendingCount === 0) return null

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Resultados</h2>
      <div className="space-y-4">
        {Array.from({ length: pendingCount }).map((_, i) => (
          <CaptionCardSkeleton key={`skeleton-${i}`} />
        ))}
        {results.map((result) => (
          <CaptionCard key={result.id} result={result} />
        ))}
      </div>
    </section>
  )
}

export function CaptionCardSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-mid" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-mid" />
          <div className="h-4 w-full rounded bg-gray-mid" />
          <div className="h-4 w-5/6 rounded bg-gray-mid" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-gray-mid" />
        <div className="h-6 w-24 rounded-full bg-gray-mid" />
        <div className="h-6 w-16 rounded-full bg-gray-mid" />
      </div>
    </div>
  )
}

export function GroupCardSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="h-5 w-1/3 rounded bg-gray-mid" />
      <div className="mt-2 h-4 w-2/3 rounded bg-gray-mid" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 w-16 rounded-lg bg-gray-mid" />
        ))}
      </div>
    </div>
  )
}

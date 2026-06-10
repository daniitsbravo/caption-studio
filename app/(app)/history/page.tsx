'use client'

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { CaptionRow } from '@/types/database'
import { cn, formatDate } from '@/lib/utils'

const PAGE_SIZE = 20

export default function HistoryPage() {
  const [rows, setRows] = useState<CaptionRow[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Debounce de la búsqueda en tiempo real
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let q = supabase
      .from('captions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (query) {
      const escaped = query.replace(/[%_,()]/g, '')
      q = q.or(`caption.ilike.%${escaped}%,image_name.ilike.%${escaped}%`)
    }

    const { data, count, error } = await q

    if (error) {
      toast.error('No se pudo cargar el historial')
    } else {
      setRows(data ?? [])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [page, query])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este caption? Esta acción no se puede deshacer.')) {
      return
    }

    setDeletingId(id)
    try {
      const res = await fetch(`/api/captions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Caption eliminado')
      fetchRows()
    } catch {
      toast.error('No se pudo eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  function handleCopy(row: CaptionRow) {
    const tags = row.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    navigator.clipboard.writeText(`${row.caption}\n\n${tags}`)
    toast.success('Copiado al portapapeles')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <h1 className="text-2xl font-semibold">Historial</h1>
      <p className="mt-1 text-sm text-gray-dark">
        Todos tus captions generados, ordenados por fecha
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por caption o nombre de imagen…"
        className="input mt-6 max-w-md"
      />

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-dark">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-dark">
            {query
              ? 'No hay resultados para esa búsqueda.'
              : 'Aún no has generado ningún caption. Empieza desde el Dashboard.'}
          </div>
        ) : (
          rows.map((row) => {
            const thumbs = row.is_carousel
              ? row.carousel_image_urls.length
                ? row.carousel_image_urls
                : [row.image_url]
              : [row.image_url]

            return (
              <div key={row.id} className="card p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex shrink-0 gap-2 overflow-x-auto">
                    {thumbs.map((url, i) => (
                      <img
                        key={url + i}
                        src={url}
                        alt={row.image_name ?? 'Imagen'}
                        className={cn(
                          'h-20 w-20 rounded-lg object-cover',
                          i > 0 && 'hidden sm:block'
                        )}
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {row.image_name ?? 'Sin nombre'}
                      </span>
                      {row.is_carousel && (
                        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white">
                          Carrusel
                        </span>
                      )}
                      <span className="ml-auto text-xs text-gray-dark">
                        {formatDate(row.created_at)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-dark">
                      {row.caption.length > 100
                        ? `${row.caption.slice(0, 100)}…`
                        : row.caption}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.hashtags.slice(0, 8).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-light px-2 py-0.5 text-[11px] text-gray-dark"
                        >
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                      {row.hashtags.length > 8 && (
                        <span className="text-[11px] text-gray-dark/60">
                          +{row.hashtags.length - 8} más
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCopy(row)}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Copiar
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="btn-secondary px-3 py-1 text-xs text-red-700"
                      >
                        {deletingId === row.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="btn-secondary px-3 py-1 text-xs"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-dark">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="btn-secondary px-3 py-1 text-xs"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'Historial' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === '/dashboard'
            ? pathname.startsWith('/dashboard')
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-ink text-white' : 'text-gray-dark hover:bg-gray-light'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Barra superior en móvil */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-gray-mid bg-white px-4 py-3 md:hidden">
        <span className="text-lg font-semibold">CaptionStudio</span>
        <button
          onClick={() => setOpen(!open)}
          className="btn-secondary px-3 py-1.5"
          aria-label="Abrir menú"
        >
          {open ? '✕' : '☰'}
        </button>
      </header>

      {/* Menú desplegable en móvil */}
      {open && (
        <div className="fixed inset-x-0 top-[53px] z-30 border-b border-gray-mid bg-white p-4 md:hidden">
          {nav}
          <button onClick={handleSignOut} className="btn-secondary mt-4 w-full">
            Cerrar sesión
          </button>
        </div>
      )}

      {/* Sidebar en escritorio */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-gray-mid bg-white p-4 md:flex">
        <div className="mb-8 px-3 pt-2">
          <span className="text-lg font-semibold">CaptionStudio</span>
          <p className="mt-0.5 text-xs text-gray-dark">
            Captions con IA para arquitectura
          </p>
        </div>
        {nav}
        <button onClick={handleSignOut} className="btn-secondary mt-4">
          Cerrar sesión
        </button>
      </aside>

      {/* Espaciador para la barra superior en móvil */}
      <div className="h-[53px] md:hidden" aria-hidden />
    </>
  )
}

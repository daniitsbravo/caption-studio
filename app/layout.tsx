import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'CaptionStudio',
  description:
    'Genera captions de Instagram con IA para fotografía de arquitectura y construcción',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-gray-light font-sans text-ink antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}

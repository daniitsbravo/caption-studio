'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useStudioStore, type UploadedImage } from '@/lib/store'
import {
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGES_PER_SESSION,
  cn,
  fileToBase64,
  sanitizeFileName,
} from '@/lib/utils'

export default function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const images = useStudioStore((s) => s.images)
  const addImages = useStudioStore((s) => s.addImages)

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return

    const remaining = MAX_IMAGES_PER_SESSION - images.length
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_IMAGES_PER_SESSION} imágenes por sesión`)
      return
    }

    const valid: File[] = []
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: formato no soportado (usa JPG, PNG o WEBP)`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: supera el límite de 10MB`)
        continue
      }
      valid.push(file)
    }

    if (valid.length > remaining) {
      toast.warning(`Solo se añadirán ${remaining} imágenes (límite de ${MAX_IMAGES_PER_SESSION})`)
      valid.splice(remaining)
    }

    if (!valid.length) return

    setUploading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Sesión expirada. Vuelve a iniciar sesión.')
      setUploading(false)
      return
    }

    const uploaded: UploadedImage[] = []

    for (const file of valid) {
      try {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`

        const { error: uploadError } = await supabase.storage
          .from('caption-images')
          .upload(path, file, { contentType: file.type })

        if (uploadError) throw new Error(uploadError.message)

        const {
          data: { publicUrl },
        } = supabase.storage.from('caption-images').getPublicUrl(path)

        const base64 = await fileToBase64(file)

        uploaded.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          base64,
          mediaType: file.type,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'error desconocido'
        toast.error(`No se pudo subir ${file.name}: ${message}`)
      }
    }

    if (uploaded.length) {
      addImages(uploaded)
      toast.success(
        uploaded.length === 1
          ? 'Imagen subida'
          : `${uploaded.length} imágenes subidas`
      )
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-10 text-center transition-colors',
        dragging ? 'border-ink bg-gray-light' : 'border-gray-mid hover:bg-gray-light/50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <svg
        className="mb-3 h-10 w-10 text-gray-dark/40"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>

      {uploading ? (
        <p className="text-sm font-medium">Subiendo imágenes…</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            Arrastra tus fotos aquí o haz clic para seleccionarlas
          </p>
          <p className="mt-1 text-xs text-gray-dark">
            JPG, PNG o WEBP · máx. 10MB por archivo · hasta {MAX_IMAGES_PER_SESSION}{' '}
            imágenes ({images.length}/{MAX_IMAGES_PER_SESSION})
          </p>
        </>
      )}
    </div>
  )
}

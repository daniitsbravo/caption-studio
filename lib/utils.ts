export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_IMAGES_PER_SESSION = 10
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildCopyText(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ')
  return `${caption}\n\n${tags}`
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

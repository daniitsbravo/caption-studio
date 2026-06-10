import { create } from 'zustand'

export interface UploadedImage {
  id: string
  name: string
  /** URL pública en Supabase Storage */
  url: string
  /** Base64 sin prefijo data: — se envía a las API routes */
  base64: string
  mediaType: string
}

export interface SuggestedGroup {
  group_id: string
  title: string
  rationale: string
  image_ids: string[]
  cover_image_id: string
}

export interface CaptionResult {
  /** id de la fila en la tabla captions */
  id: string
  caption: string
  hashtags: string[]
  imageUrls: string[]
  imageName: string
  isCarousel: boolean
  /** ids de las imágenes del store usadas (para regenerar) */
  sourceImageIds: string[]
  groupTitle?: string
}

interface StudioState {
  images: UploadedImage[]
  groups: SuggestedGroup[]
  results: CaptionResult[]

  addImages: (images: UploadedImage[]) => void
  removeImage: (id: string) => void
  clearImages: () => void

  setGroups: (groups: SuggestedGroup[]) => void
  updateGroup: (groupId: string, patch: Partial<SuggestedGroup>) => void
  removeGroup: (groupId: string) => void
  addGroup: (group: SuggestedGroup) => void
  clearGroups: () => void

  addResult: (result: CaptionResult) => void
  updateResult: (id: string, patch: Partial<CaptionResult>) => void
  clearResults: () => void
}

export const useStudioStore = create<StudioState>((set) => ({
  images: [],
  groups: [],
  results: [],

  addImages: (images) => set((s) => ({ images: [...s.images, ...images] })),
  removeImage: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
  clearImages: () => set({ images: [] }),

  setGroups: (groups) => set({ groups }),
  updateGroup: (groupId, patch) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.group_id === groupId ? { ...g, ...patch } : g)),
    })),
  removeGroup: (groupId) =>
    set((s) => ({ groups: s.groups.filter((g) => g.group_id !== groupId) })),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  clearGroups: () => set({ groups: [] }),

  addResult: (result) => set((s) => ({ results: [result, ...s.results] })),
  updateResult: (id, patch) =>
    set((s) => ({
      results: s.results.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  clearResults: () => set({ results: [] }),
}))

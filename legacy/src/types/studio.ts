export type StudioView = 'create' | 'models' | 'projects' | 'library' | 'brand'
export type MediaMode = 'image' | 'video'
export type Tool = 'select' | 'crop' | 'text' | 'shapes' | 'adjust'

export type LayerKind = 'art' | 'text' | 'shape'

export type Layer = {
  id: string
  kind: LayerKind
  name: string
  visible: boolean
  /* texto */
  text?: string
  size?: number
  /* forma */
  shape?: 'rect' | 'circle'
  color?: string
  /* posição relativa ao artboard, 0-100 */
  x?: number
  y?: number
}

/** Estado versionado do editor — tudo aqui entra no undo/redo. */
export type EditorDoc = {
  art: string
  aspectRatio: string
  layers: Layer[]
  temperature: number
  contrast: number
  rotation: number
  upscaled: boolean
  bgRemoved: boolean
}

export type Project = {
  id: string
  name: string
  mode: MediaMode
  art: string
  updatedAt: string
  status: 'draft' | 'ready'
  doc?: EditorDoc
}

export type Asset = {
  id: string
  name: string
  kind: MediaMode
  art: string
  createdAt: string
}

export type BrandKit = {
  name: string
  colors: string[]
  headingFont: string
  bodyFont: string
  voice: string
}

export type ModelPreset = {
  id: string
  name: string
  category: 'people' | 'animals' | 'products'
  description: string
  prompt: string
  spritePosition: string
  tone: string
}

export type ModelDescriptor = {
  id: string
  name: string
  provider: string
  kind: MediaMode
  capabilities: string[]
  costCredits: number
  estimatedSeconds: number
}

export const ASPECT_RATIOS = ['1:1', '4:5', '3:2', '16:9', '9:16'] as const
export const STYLES = ['Editorial', '3D', 'Foto', 'Arte'] as const

export function aspectValue(ratio: string) {
  const [w, h] = ratio.split(':').map(Number)
  return w && h ? w / h : 1
}

export function createDoc(art = 'aurora'): EditorDoc {
  return {
    art,
    aspectRatio: '1:1',
    layers: [
      { id: 'layer-art', kind: 'art', name: 'Arte gerada', visible: true },
      { id: 'layer-title', kind: 'text', name: 'NEW IDEAS', visible: true, text: 'New ideas', size: 100, x: 8, y: 74 },
      { id: 'layer-sub', kind: 'text', name: 'Imagine beyond...', visible: true, text: 'Imagine beyond the ordinary.', size: 30, x: 8, y: 88 },
    ],
    temperature: 58,
    contrast: 52,
    rotation: 0,
    upscaled: false,
    bgRemoved: false,
  }
}

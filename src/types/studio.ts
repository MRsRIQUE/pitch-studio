export type StudioView = 'create' | 'models' | 'projects' | 'library' | 'brand'
export type MediaMode = 'image' | 'video'
export type Tool = 'select' | 'crop' | 'text' | 'shapes' | 'adjust'

export type Project = {
  id: string
  name: string
  mode: MediaMode
  art: string
  updatedAt: string
  status: 'draft' | 'ready'
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

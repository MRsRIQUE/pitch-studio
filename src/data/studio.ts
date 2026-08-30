import type { Asset, BrandKit, Project } from '../types/studio'

export const variations = [
  { id: 0, className: 'aurora', label: 'Aurora prismática' },
  { id: 1, className: 'chrome', label: 'Escultura cromada' },
  { id: 2, className: 'petal', label: 'Pétalas digitais' },
  { id: 3, className: 'orbit', label: 'Órbita violeta' },
]

export const initialProjects: Project[] = [
  { id: 'neon', name: 'Campanha Neon', mode: 'image', art: 'aurora', updatedAt: 'Agora', status: 'draft' },
  { id: 'summer', name: 'Produto verão', mode: 'image', art: 'petal', updatedAt: 'Ontem', status: 'ready' },
  { id: 'social', name: 'Social pack', mode: 'video', art: 'orbit', updatedAt: '18 ago', status: 'ready' },
  { id: 'launch', name: 'Lançamento Q3', mode: 'image', art: 'chrome', updatedAt: '15 ago', status: 'draft' },
]

export const initialAssets: Asset[] = [
  { id: 'asset-1', name: 'Glass sculpture 01', kind: 'image', art: 'aurora', createdAt: 'Hoje, 22:16' },
  { id: 'asset-2', name: 'Chrome form', kind: 'image', art: 'chrome', createdAt: 'Hoje, 22:15' },
  { id: 'asset-3', name: 'Summer petals', kind: 'image', art: 'petal', createdAt: 'Ontem' },
  { id: 'asset-4', name: 'Violet motion', kind: 'video', art: 'orbit', createdAt: '18 ago' },
  { id: 'asset-5', name: 'Neon variation', kind: 'image', art: 'aurora', createdAt: '17 ago' },
  { id: 'asset-6', name: 'Metallic hero', kind: 'video', art: 'chrome', createdAt: '15 ago' },
]

export const initialBrand: BrandKit = {
  name: 'Pitch AI',
  colors: ['#A775FF', '#FF8A98', '#17131D', '#F6F4F9'],
  headingFont: 'Manrope',
  bodyFont: 'DM Sans',
  voice: 'Clara, confiante e inventiva. Frases curtas, linguagem acessível e foco em transformação.',
}

export type GenerationKind = 'image' | 'video'
export type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

export type ModelDescriptor = {
  id: string
  name: string
  provider: string
  kind: GenerationKind
  capabilities: string[]
  costCredits: number
  estimatedSeconds: number
}

export type GenerationInput = {
  workspaceId: string
  projectId: string
  prompt: string
  kind: GenerationKind
  modelId: string
  aspectRatio: string
  style?: string
  presetId?: string
  brandSnapshot?: {
    name: string
    colors: string[]
    headingFont: string
    bodyFont: string
    voice: string
  }
}

export type GenerationResult = {
  assetId: string
  art: 'aurora' | 'chrome' | 'petal' | 'orbit'
  mimeType: string
  width: number
  height: number
}

export type GenerationJob = {
  id: string
  status: JobStatus
  input: GenerationInput
  costCredits: number
  provider: string
  createdAt: string
  updatedAt: string
  result?: GenerationResult
  error?: string
}

export type AssetRecord = {
  id: string
  workspaceId: string
  projectId: string
  generationId: string
  kind: GenerationKind
  mimeType: string
  storageKey: string
  metadata: GenerationResult
  createdAt: string
}

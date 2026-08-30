import type { MediaMode } from '../../types/studio'
import type { Asset, BrandKit } from '../../types/studio'

export type GenerationJob = {
  id: string
  status: 'queued' | 'processing' | 'succeeded' | 'failed'
  costCredits: number
  result?: { assetId: string; art: 'aurora' | 'chrome' | 'petal' | 'orbit'; mimeType: string; width: number; height: number }
  error?: string
}

type CreateInput = { prompt: string; kind: MediaMode; projectId: string; presetId: string; brandSnapshot: BrandKit; style: string; aspectRatio?: string }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`API_${response.status}`)
  return response.json() as Promise<T>
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function generateMedia(input: CreateInput, onStatus?: (status: GenerationJob['status']) => void) {
  const modelId = input.kind === 'image' ? 'mock-flux-ultra' : 'mock-kling-motion'
  const created = await request<{ data: GenerationJob }>('/api/v1/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, workspaceId: 'demo-workspace', modelId, aspectRatio: input.aspectRatio ?? '1:1' }),
  })

  let job = created.data
  onStatus?.(job.status)
  for (let attempt = 0; attempt < 30 && !['succeeded', 'failed'].includes(job.status); attempt += 1) {
    await wait(350)
    job = (await request<{ data: GenerationJob }>(`/api/v1/generations/${job.id}`)).data
    onStatus?.(job.status)
  }
  if (job.status !== 'succeeded' || !job.result) throw new Error(job.error ?? 'GENERATION_TIMEOUT')
  return job
}

export async function getCreditBalance() {
  const response = await request<{ data: { balance: number } }>('/api/v1/credits')
  return response.data.balance
}

export async function getAssets(): Promise<Asset[]> {
  const response = await request<{ data: Array<{ id: string; kind: MediaMode; createdAt: string; input: { prompt: string }; metadata: { art: string } }> }>('/api/v1/assets')
  return response.data.map((asset) => ({ id: asset.id, name: asset.input.prompt.slice(0, 34), kind: asset.kind, art: asset.metadata.art, createdAt: new Date(asset.createdAt).toLocaleDateString('pt-BR') }))
}

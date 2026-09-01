import type { Asset, BrandKit, MediaMode, ModelDescriptor } from '../../types/studio'

export type GenerationJob = {
  id: string
  status: 'queued' | 'processing' | 'succeeded' | 'failed'
  costCredits: number
  result?: { assetId: string; art: 'aurora' | 'chrome' | 'petal' | 'orbit'; mimeType: string; width: number; height: number }
  error?: string
}

type CreateInput = {
  prompt: string
  kind: MediaMode
  projectId: string
  presetId: string
  brandSnapshot: BrandKit
  style: string
  modelId: string
  aspectRatio: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    let code = `API_${response.status}`
    try {
      const body = await response.json() as { error?: string }
      if (body?.error) code = body.error
    } catch { /* corpo não-JSON: mantém o código HTTP */ }
    throw new Error(code)
  }
  return response.json() as Promise<T>
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function getModels(): Promise<ModelDescriptor[]> {
  const response = await request<{ data: ModelDescriptor[] }>('/api/v1/models')
  return response.data
}

export async function generateMedia(input: CreateInput, onStatus?: (status: GenerationJob['status']) => void) {
  const created = await request<{ data: GenerationJob }>('/api/v1/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, workspaceId: 'demo-workspace' }),
  })

  let job = created.data
  onStatus?.(job.status)
  for (let attempt = 0; attempt < 40 && !['succeeded', 'failed'].includes(job.status); attempt += 1) {
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
  return response.data.map((asset) => ({
    id: asset.id,
    name: asset.input.prompt.slice(0, 40),
    kind: asset.kind,
    art: asset.metadata.art,
    createdAt: new Date(asset.createdAt).toLocaleDateString('pt-BR'),
  }))
}

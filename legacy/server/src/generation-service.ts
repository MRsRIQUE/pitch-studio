import type { GenerationInput, GenerationJob, ModelDescriptor } from './domain.js'
import { AssetRepository, CreditRepository, GenerationRepository, QueueRepository } from './persistence/repositories.js'
import type { MediaProvider } from './providers/provider.js'
import { LocalAssetStorage } from './storage/local-storage.js'

export class GenerationService {
  private readonly providers: Map<string, MediaProvider>
  private readonly generations = new GenerationRepository()
  private readonly queue = new QueueRepository()
  private readonly credits = new CreditRepository()
  private readonly assets = new AssetRepository()
  private readonly storage = new LocalAssetStorage()
  private readonly active = new Set<string>()

  constructor(providers: MediaProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]))
    this.queue.recover()
    for (const job of this.generations.recoverable()) {
      this.generations.update(job.id, { status: 'queued' })
      this.queue.enqueue(job.id)
      void this.process(job.id)
    }
  }

  listModels(): ModelDescriptor[] { return [...this.providers.values()].flatMap((provider) => provider.listModels()) }
  get(id: string) { return this.generations.get(id) }
  creditBalance() { return this.credits.balance() }
  listAssets() { return this.assets.list() }

  create(input: GenerationInput): GenerationJob {
    const model = this.listModels().find((candidate) => candidate.id === input.modelId && candidate.kind === input.kind)
    if (!model) throw new Error('MODEL_NOT_FOUND')
    const now = new Date().toISOString()
    const job: GenerationJob = { id: crypto.randomUUID(), status: 'queued', input, costCredits: model.costCredits, provider: model.provider, createdAt: now, updatedAt: now }
    this.generations.insert(job)
    try {
      this.credits.debit(job.id, job.costCredits)
      this.queue.enqueue(job.id)
      void this.process(job.id)
      return job
    } catch (error) {
      this.generations.update(job.id, { status: 'failed', error: error instanceof Error ? error.message : 'Falha ao reservar créditos' })
      throw error
    }
  }

  private async process(id: string) {
    if (this.active.has(id)) return
    const job = this.generations.get(id)
    if (!job || job.status === 'succeeded' || job.status === 'failed') return
    this.active.add(id)
    const provider = this.providers.get(job.provider)
    if (!provider) {
      this.fail(job, 'Provider indisponível')
      return
    }
    this.queue.markRunning(id)
    this.generations.update(id, { status: 'processing' })
    try {
      const result = await provider.generate(job.input)
      const storageKey = await this.storage.save(job.id, job.input, result)
      this.assets.insert({ id: result.assetId, workspaceId: job.input.workspaceId, projectId: job.input.projectId, generationId: job.id, kind: job.input.kind, mimeType: result.mimeType, storageKey, metadata: result, createdAt: new Date().toISOString() })
      this.generations.update(id, { status: 'succeeded', result })
      this.queue.markCompleted(id)
    } catch (error) {
      this.fail(job, error instanceof Error ? error.message : 'Falha inesperada')
    } finally {
      this.active.delete(id)
    }
  }

  private fail(job: GenerationJob, message: string) {
    this.generations.update(job.id, { status: 'failed', error: message })
    this.queue.markFailed(job.id, message)
    this.credits.refund(job.id, job.costCredits)
    this.active.delete(job.id)
  }
}

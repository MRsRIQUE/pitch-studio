import cors from '@fastify/cors'
import Fastify from 'fastify'
import { z } from 'zod'
import { GenerationService } from './generation-service.js'
import { MockProvider } from './providers/mock-provider.js'

const app = Fastify({ logger: true })
const service = new GenerationService([new MockProvider()])

await app.register(cors, { origin: true })

app.get('/api/health', async () => ({ status: 'ok', service: 'pitch-studio-api', timestamp: new Date().toISOString() }))
app.get('/api/v1/models', async () => ({ data: service.listModels() }))
app.get('/api/v1/credits', async () => ({ data: { balance: service.creditBalance(), accountId: 'demo-workspace' } }))
app.get('/api/v1/assets', async () => ({ data: service.listAssets() }))

const generationSchema = z.object({
  workspaceId: z.string().min(1).max(100),
  projectId: z.string().min(1).max(100),
  prompt: z.string().trim().min(3).max(600),
  kind: z.enum(['image', 'video']),
  modelId: z.string().min(1),
  aspectRatio: z.string().regex(/^\d+:\d+$/),
  style: z.string().max(40).optional(),
  presetId: z.string().max(100).optional(),
  brandSnapshot: z.object({
    name: z.string().max(100),
    colors: z.array(z.string().max(20)).max(12),
    headingFont: z.string().max(100),
    bodyFont: z.string().max(100),
    voice: z.string().max(1000),
  }).optional(),
})

app.post('/api/v1/generations', async (request, reply) => {
  const parsed = generationSchema.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() })
  try {
    return reply.code(202).send({ data: service.create(parsed.data) })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'GENERATION_FAILED'
    return reply.code(code === 'INSUFFICIENT_CREDITS' ? 402 : 404).send({ error: code })
  }
})

app.get<{ Params: { id: string } }>('/api/v1/generations/:id', async (request, reply) => {
  const job = service.get(request.params.id)
  return job ? { data: job } : reply.code(404).send({ error: 'JOB_NOT_FOUND' })
})

const port = Number(process.env.PORT ?? 8787)
await app.listen({ host: '127.0.0.1', port })

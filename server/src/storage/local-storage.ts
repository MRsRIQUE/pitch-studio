import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GenerationInput, GenerationResult } from '../domain.js'

export class LocalAssetStorage {
  private readonly directory = resolve(process.cwd(), 'data', 'assets')

  async save(generationId: string, input: GenerationInput, result: GenerationResult) {
    await mkdir(this.directory, { recursive: true })
    const storageKey = `${result.assetId}.json`
    await writeFile(resolve(this.directory, storageKey), JSON.stringify({ generationId, input, result, storedAt: new Date().toISOString() }, null, 2), 'utf8')
    return storageKey
  }
}

import type { GenerationInput, GenerationResult, ModelDescriptor } from '../domain.js'

export interface MediaProvider {
  readonly id: string
  listModels(): ModelDescriptor[]
  generate(input: GenerationInput): Promise<GenerationResult>
}

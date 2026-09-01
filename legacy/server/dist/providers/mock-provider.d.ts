import type { GenerationInput, GenerationResult, ModelDescriptor } from '../domain.js';
import type { MediaProvider } from './provider.js';
export declare class MockProvider implements MediaProvider {
    readonly id = "pitch-mock";
    listModels(): ModelDescriptor[];
    generate(input: GenerationInput): Promise<GenerationResult>;
}

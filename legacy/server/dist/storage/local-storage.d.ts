import type { GenerationInput, GenerationResult } from '../domain.js';
export declare class LocalAssetStorage {
    private readonly directory;
    save(generationId: string, input: GenerationInput, result: GenerationResult): Promise<string>;
}

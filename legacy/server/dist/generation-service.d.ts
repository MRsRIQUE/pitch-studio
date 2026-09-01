import type { GenerationInput, GenerationJob, ModelDescriptor } from './domain.js';
import type { MediaProvider } from './providers/provider.js';
export declare class GenerationService {
    private readonly providers;
    private readonly generations;
    private readonly queue;
    private readonly credits;
    private readonly assets;
    private readonly storage;
    private readonly active;
    constructor(providers: MediaProvider[]);
    listModels(): ModelDescriptor[];
    get(id: string): GenerationJob | undefined;
    creditBalance(): number;
    listAssets(): {
        metadata: any;
        input: any;
        metadataJson: undefined;
        inputJson: undefined;
    }[];
    create(input: GenerationInput): GenerationJob;
    private process;
    private fail;
}

import type { AssetRecord, GenerationJob } from '../domain.js';
export declare class GenerationRepository {
    insert(job: GenerationJob): void;
    get(id: string): GenerationJob | undefined;
    update(id: string, patch: Partial<Pick<GenerationJob, 'status' | 'result' | 'error'>>): void;
    recoverable(): GenerationJob[];
}
export declare class QueueRepository {
    enqueue(generationId: string): void;
    markRunning(generationId: string): void;
    markCompleted(generationId: string): void;
    markFailed(generationId: string, error: string): void;
    recover(): void;
}
export declare class CreditRepository {
    balance(accountId?: string): number;
    debit(generationId: string, amount: number, accountId?: string): void;
    refund(generationId: string, amount: number, accountId?: string): void;
}
export declare class AssetRepository {
    insert(asset: AssetRecord): void;
    list(): {
        metadata: any;
        input: any;
        metadataJson: undefined;
        inputJson: undefined;
    }[];
}

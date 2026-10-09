import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export class LocalAssetStorage {
    directory = resolve(process.cwd(), 'data', 'assets');
    async save(generationId, input, result) {
        await mkdir(this.directory, { recursive: true });
        const storageKey = `${result.assetId}.json`;
        await writeFile(resolve(this.directory, storageKey), JSON.stringify({ generationId, input, result, storedAt: new Date().toISOString() }, null, 2), 'utf8');
        return storageKey;
    }
}

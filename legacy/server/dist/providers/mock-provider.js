const models = [
    { id: 'mock-flux-ultra', name: 'Flux Pro Ultra', provider: 'pitch-mock', kind: 'image', capabilities: ['text-to-image', 'image-reference'], costCredits: 4, estimatedSeconds: 2 },
    { id: 'mock-kling-motion', name: 'Kling Motion', provider: 'pitch-mock', kind: 'video', capabilities: ['text-to-video', 'image-to-video'], costCredits: 24, estimatedSeconds: 4 },
];
const arts = ['aurora', 'chrome', 'petal', 'orbit'];
function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
export class MockProvider {
    id = 'pitch-mock';
    listModels() { return models; }
    async generate(input) {
        await delay(input.kind === 'video' ? 1800 : 950);
        const hash = [...input.prompt].reduce((total, character) => total + character.charCodeAt(0), 0);
        const art = arts[hash % arts.length];
        return {
            assetId: crypto.randomUUID(),
            art,
            mimeType: input.kind === 'video' ? 'video/mp4' : 'image/webp',
            width: 1080,
            height: 1080,
        };
    }
}

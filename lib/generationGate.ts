/**
 * Quando a UI deve bloquear a geração de mídia.
 *
 * A base herdada desabilitava os botões sempre que não havia chave kie.ai
 * (`kieKeySet === false`). Com o provider simulado do Pitch Studio ativo a
 * geração funciona sem chave — produz placeholder em vez de mídia real — então
 * bloquear a UI deixaria o mock inalcançável.
 *
 * Cobre só geração de imagem e vídeo. Chat e assistente continuam exigindo
 * chave de verdade: o mock não simula LLM.
 *
 * Ver lib/mockProvider.ts.
 */
export const MOCK_GENERATION_ON = process.env.NEXT_PUBLIC_MOCK_GENERATION !== "false";

export function generationBlocked(kieKeySet: boolean | null | undefined): boolean {
  return kieKeySet === false && !MOCK_GENERATION_ON;
}

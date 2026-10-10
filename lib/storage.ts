/**
 * Fachada estável da mídia do Studio — ver `lib/media/index.ts` (Vercel Blob
 * em produção, disco local em desenvolvimento).
 */
export { ensureStorage, mirrorToStorage, uploadBuffer, uploadDataUrl } from "./media";
import { ensureStorage, mirrorToStorage } from "./media";

/** Nomes antigos, mantidos para as rotas não mudarem. */
export const mirrorToR2 = mirrorToStorage;
export const ensureR2 = ensureStorage;

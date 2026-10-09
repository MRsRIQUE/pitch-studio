/**
 * Índice SHA-256 → URL guardada, para o mesmo arquivo reaproveitar a mesma
 * URL. Vive na camada de dados (`lib/data`).
 */
import { createHash } from "crypto";
import { data } from "./data";

/** Compute SHA-256 hex from a Node.js Buffer (server-side). */
export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Look up a previously-stored asset by its SHA-256 hash. */
export async function lookupAssetHash(hash: string): Promise<string | null> {
  return (await data()).lookupAssetHash(hash);
}

/** Store a hash → URL mapping (idempotent). */
export async function storeAssetHash(
  hash: string,
  cdnUrl: string,
  mimeType: string,
  byteSize: number,
): Promise<void> {
  await (await data()).storeAssetHash(hash, cdnUrl, mimeType, byteSize);
}

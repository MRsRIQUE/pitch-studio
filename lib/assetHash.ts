/**
 * Compute a SHA-256 hex digest using the Web Crypto API.
 * Works in the browser and in Node.js 18+ (global `crypto.subtle`).
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

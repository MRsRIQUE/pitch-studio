import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID, createHash } from "crypto";
import https from "node:https";
import http  from "node:http";
import { lookupAssetHash, storeAssetHash } from "./db";
import { stripMetadata } from "../mediaMetadata";
import { MEDIA_DIR as GENERATED_DIR } from "./paths";

function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function ext(contentType: string): string {
  if (contentType.includes("model/gltf-binary")) return "glb";
  if (contentType.includes("audio/webm")) return "weba";
  if (contentType.includes("audio/opus")) return "opus";
  if (contentType.includes("audio/mpeg")) return "mp3";
  if (contentType.includes("audio/wav") || contentType.includes("audio/x-wav")) return "wav";
  if (contentType.includes("audio/ogg")) return "ogg";
  if (contentType.includes("audio/mp4")) return "m4a";
  if (contentType.includes("audio/flac")) return "flac";
  if (contentType.includes("audio/aac")) return "aac";
  if (contentType.startsWith("audio/")) return "bin";
  if (contentType.includes("mp4"))  return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("png"))  return "png";
  if (contentType.includes("gif"))  return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadBuffer(buffer: Buffer, contentType: string, folder: string): Promise<string> {
  buffer = await stripMetadata(buffer, contentType);
  const hash   = hashBuffer(buffer);
  const cached = lookupAssetHash(hash);
  if (cached) return cached;

  await mkdir(join(GENERATED_DIR, folder), { recursive: true });
  const filename = `${randomUUID()}.${ext(contentType)}`;
  await writeFile(join(GENERATED_DIR, folder, filename), buffer);
  const url = `/generated/${folder}/${filename}`;

  storeAssetHash(hash, url, contentType, buffer.byteLength);
  return url;
}

function fetchToBuffer(url: string, maxRedirects = 5): Promise<{ buf: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
    const u   = new URL(url);
    const mod = u.protocol === "https:" ? https : (http as unknown as typeof https);
    mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchToBuffer(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on("data",  (c: Buffer) => chunks.push(c));
      res.on("end",   () => resolve({ buf: Buffer.concat(chunks), contentType: res.headers["content-type"] ?? "image/jpeg" }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Provider result CDNs (kie.ai's `tempfile.aiquickdraw.com`, etc.) occasionally
 *  drop a connection mid-transfer. A caller that gives up on the first failure
 *  falls back to that source URL — which is often a genuinely temporary link —
 *  so retry a couple of times before surfacing the error. */
export async function mirrorToStorage(url: string, folder: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { buf, contentType } = await fetchToBuffer(url);
      return await uploadBuffer(buf, contentType, folder);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr;
}

export async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) throw new Error("Not a valid data URL");
  return uploadBuffer(Buffer.from(m[2], "base64"), m[1], folder);
}

/** Resolve any URL to a locally-stored `/generated/...` path. Remote URLs are
 *  mirrored to disk; `data:` URLs are decoded; already-local paths pass through.
 *  kie.ai reference images are made reachable separately by `lib/kieUpload.ts`
 *  (base64 upload to kie's temp store), so no public tunnel URL is needed. */
export async function ensureStorage(url: string, folder: string): Promise<string> {
  if (url.startsWith("data:"))         return uploadDataUrl(url, folder);
  if (url.startsWith("/generated/"))   return url;
  return mirrorToStorage(url, folder);
}

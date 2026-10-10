/**
 * Onde a mídia do Studio mora. Vercel Blob em produção (`BLOB_READ_WRITE_TOKEN`),
 * disco local em desenvolvimento (`/generated/...`, servido por
 * `app/generated/[...path]`). Na Vercel sem token é erro: disco de função é
 * efêmero e perderia o arquivo.
 *
 * A assinatura é a do antigo `lib/guest/localStorage.ts`, então as rotas
 * continuam chamando `uploadBuffer`, `mirrorToStorage` e `ensureStorage`.
 * O dedupe por SHA-256 continua, agora no cache de hash da camada de dados.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { data } from "@/lib/data";
import { MEDIA_DIR } from "@/lib/guest/paths";
import { stripMetadata } from "@/lib/mediaMetadata";

/** Hosts de onde aceitamos mídia já guardada (o nosso Blob). */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isStoredUrl(url: string): boolean {
  if (url.startsWith("/generated/")) return true;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function blobEnabled(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN não está definida na Vercel.");
  return false;
}

export function extensionFor(contentType: string): string {
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
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

export async function uploadBuffer(buffer: Buffer, contentType: string, folder: string): Promise<string> {
  buffer = await stripMetadata(buffer, contentType);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const store = await data();
  const cached = await store.lookupAssetHash(hash);
  if (cached) return cached;

  const filename = `${randomUUID()}.${extensionFor(contentType)}`;
  let url: string;
  if (blobEnabled()) {
    const blob = await put(`${folder}/${filename}`, buffer, { access: "public", contentType });
    url = blob.url;
  } else {
    await mkdir(join(MEDIA_DIR, folder), { recursive: true });
    await writeFile(join(MEDIA_DIR, folder, filename), buffer);
    url = `/generated/${folder}/${filename}`;
  }
  await store.storeAssetHash(hash, url, contentType, buffer.byteLength);
  return url;
}

const MAX_FETCH_BYTES = 200 * 1024 * 1024;

/**
 * Endereço de rede interna (loopback, privada, link-local, metadados de
 * nuvem). O servidor do Studio não baixa nada daí — senão vira ponte para
 * dentro da infraestrutura.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(127|10|0)\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(h)) return true;
  // IPv6 literal (só quando há ":" — "fcbarcelona.com" é um domínio comum).
  if (h.includes(":")) {
    return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  }
  return false;
}

/** Baixa uma URL http(s) pública para memória, com teto de tamanho. */
export async function fetchToBuffer(url: string): Promise<{ buf: Buffer; contentType: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(`URL não suportada: ${url}`);
  if (isPrivateHost(parsed.hostname)) throw new Error("Endereço não permitido.");
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${parsed.hostname}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FETCH_BYTES) throw new Error("Arquivo grande demais.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_FETCH_BYTES) throw new Error("Arquivo grande demais.");
  return { buf, contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

/**
 * Os CDNs de resultado dos provedores às vezes derrubam a conexão no meio;
 * tenta três vezes antes de desistir, porque o link de origem costuma expirar.
 */
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

/** Qualquer URL vira uma URL nossa: `data:` é decodificada, externa é espelhada. */
export async function ensureStorage(url: string, folder: string): Promise<string> {
  if (url.startsWith("data:")) return uploadDataUrl(url, folder);
  if (isStoredUrl(url)) return url;
  return mirrorToStorage(url, folder);
}

/** Lê os bytes de uma URL nossa (Blob ou `/generated/` em dev) ou externa. */
export async function readStoredBytes(url: string): Promise<Buffer> {
  if (url.startsWith("/generated/")) {
    const { readFile } = await import("node:fs/promises");
    const { normalize } = await import("node:path");
    const rel = normalize(decodeURIComponent(url.slice("/generated/".length).split(/[?#]/)[0]));
    if (rel.startsWith("..") || rel.includes("\0")) throw new Error(`Caminho fora da mídia: ${url}`);
    return readFile(join(MEDIA_DIR, rel));
  }
  return (await fetchToBuffer(url)).buf;
}

/**
 * Envio de arquivo do navegador para a mídia do Studio, com a mesma forma de
 * `fetch("/api/upload-asset", init)` — as telas trocam só o nome da função e
 * continuam lendo `{ cdnUrl }` da resposta.
 *
 * Na Vercel o corpo de uma função tem limite de ~4,5 MB. Acima de
 * LIMITE_SERVIDOR, e com `NEXT_PUBLIC_STUDIO_DIRECT_UPLOAD=1`, o arquivo vai
 * direto do navegador para o Vercel Blob (token emitido por
 * `/api/blob-upload`, que confere a sessão) e só a URL passa pelo servidor,
 * em `/api/upload-asset/registrar`. Abaixo disso, o caminho antigo: o servidor
 * recebe os bytes, limpa metadados e deduplica.
 */
import { upload } from "@vercel/blob/client";

const LIMITE_SERVIDOR = 4 * 1024 * 1024;

const EXTENSAO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "model/gltf-binary": "glb",
};

function tamanho(body: BodyInit | null | undefined): number {
  if (!body) return 0;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return 0;
}

export async function uploadAssetFetch(init: RequestInit): Promise<Response> {
  const direto = process.env.NEXT_PUBLIC_STUDIO_DIRECT_UPLOAD === "1";
  if (!direto || tamanho(init.body) <= LIMITE_SERVIDOR) return fetch("/api/upload-asset", init);

  const contentType = new Headers(init.headers).get("content-type") || "application/octet-stream";
  const body = init.body as Blob | ArrayBuffer | ArrayBufferView;
  const arquivo = body instanceof Blob ? body : new Blob([body as BlobPart], { type: contentType });
  const pasta = contentType.startsWith("video/") ? "references" : "uploads";
  const nome = `${pasta}/${crypto.randomUUID()}.${EXTENSAO[contentType] ?? "bin"}`;

  try {
    const enviado = await upload(nome, arquivo, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      contentType,
      abortSignal: init.signal ?? undefined,
    });
    return fetch("/api/upload-asset/registrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: enviado.url, mimeType: contentType }),
      signal: init.signal,
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: `Envio falhou: ${(erro as Error).message}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

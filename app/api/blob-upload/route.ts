/**
 * POST /api/blob-upload — emite o token de upload direto do navegador para o
 * Vercel Blob (`@vercel/blob/client`). Só com sessão, só mídia, até 200 MB.
 * Ver `lib/media/uploadAssetFetch.ts`.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

const TIPOS = ["image/*", "video/*", "audio/*", "model/gltf-binary"];
const MAX_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  // O aviso de "upload concluído" vem do próprio Blob, sem cookie; o registro
  // do arquivo é feito pelo navegador em /api/upload-asset/registrar.
  if (body.type === "blob.generate-client-token") {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const pasta = body.payload.pathname.split("/")[0];
    if (pasta !== "uploads" && pasta !== "references") {
      return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
    }
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: TIPOS,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

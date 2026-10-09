/**
 * POST /api/upload-asset/registrar { url, mimeType } — registra nos uploads
 * do usuário um arquivo que o navegador já mandou direto para o Vercel Blob.
 * Só aceita URL do nosso Blob: nada de apontar a galeria para outro lugar.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";
import { BLOB_HOST_SUFFIX } from "@/lib/media";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { url, mimeType } = (await req.json().catch(() => ({}))) as { url?: unknown; mimeType?: unknown };
  let host = "";
  try {
    host = new URL(String(url)).hostname;
  } catch {
    /* cai no 400 abaixo */
  }
  if (!host.endsWith(BLOB_HOST_SUFFIX) || typeof mimeType !== "string" || !/^(image|video|audio|model)\//.test(mimeType)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }
  await (await data()).insertUpload(user.uid, { r2_url: String(url), mime_type: mimeType, source: "user_upload" });
  return NextResponse.json({ cdnUrl: String(url) });
}

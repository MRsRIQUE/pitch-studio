import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";
import { uploadDataUrl, mirrorToStorage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * POST { dataUrl: string, folder?: string, mimeType?: string }
 *   → guarda uma data URL ou URL remota (Blob em produção)
 *   → registra nos uploads do usuário
 *   → devolve { cdnUrl: string }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const { dataUrl, folder = "uploads", mimeType } = await req.json() as {
      dataUrl:   string;
      folder?:   string;
      mimeType?: string;
    };

    if (!dataUrl) {
      return NextResponse.json({ error: "dataUrl is required" }, { status: 400 });
    }
    const safeFolder = /^[a-z0-9_-]{1,32}$/i.test(folder) ? folder : "uploads";

    let cdnUrl: string;
    if (dataUrl.startsWith("data:")) {
      cdnUrl = await uploadDataUrl(dataUrl, safeFolder);
    } else if (dataUrl.startsWith("https://")) {
      cdnUrl = await mirrorToStorage(dataUrl, safeFolder);
    } else {
      return NextResponse.json({ error: "dataUrl must be a data: or https: URL" }, { status: 400 });
    }

    await (await data()).insertUpload(user.uid, { r2_url: cdnUrl, mime_type: mimeType ?? null, source: "user_upload" });

    return NextResponse.json({ cdnUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

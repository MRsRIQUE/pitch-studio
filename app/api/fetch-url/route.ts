/**
 * POST /api/fetch-url
 *
 * Fetches a remote image/video URL server-side and uploads it to R2.
 * Body: { url: string }
 * Returns: { cdnUrl: string; mediaType: "image" | "video" }
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GUEST_MODE, resolveUserId } from "@/lib/guestMode";
import * as guestDb from "@/lib/guest/db";

export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url?: string };
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only http/https URLs are supported" }, { status: 400 });
    }

    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HeliosGen/1.0)" },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${upstream.status} ${upstream.statusText}` }, { status: 400 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const mimeType = contentType.split(";")[0].trim();

    const isImage = mimeType.startsWith("image/");
    const isVideo = mimeType.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "URL does not point to an image or video" }, { status: 400 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
    }

    const folder = isVideo ? "references" : "uploads";
    const cdnUrl = await uploadBuffer(buffer, mimeType, folder);
    const mediaType: "image" | "video" = isImage ? "image" : "video";

    // Record in user_uploads so it appears in the gallery "uploaded" section
    const userId = await resolveUserId(req);
    if (userId) {
      if (GUEST_MODE) {
        guestDb.insertUpload({ user_id: userId, r2_url: cdnUrl, mime_type: mimeType, source: "user_upload" });
      } else {
        supabaseAdmin.from("user_uploads").insert({
          user_id:   userId,
          r2_url:    cdnUrl,
          mime_type: mimeType,
          source:    "user_upload",
        }).then(({ error }) => {
          if (error) console.error("[fetch-url] db insert error:", error.message);
        });
      }
    }

    return NextResponse.json({ cdnUrl, mediaType });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

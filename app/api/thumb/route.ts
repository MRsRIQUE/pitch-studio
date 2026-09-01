/**
 * GET /api/thumb?url=<r2-url>&w=<width>
 *
 * Fetches an image from our R2 CDN with proper browser headers (avoiding
 * Cloudflare bot-detection ECONNRESET) and resizes it with sharp.
 * Drop-in replacement for /_next/image for R2 URLs.
 */
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const R2_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

const ALLOWED_WIDTHS = new Set([16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");
  const wParam = Number(searchParams.get("w") ?? "384");

  if (!url) return new NextResponse("Missing url", { status: 400 });
  if (!R2_BASE || !url.startsWith(R2_BASE)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const w = ALLOWED_WIDTHS.has(wParam) ? wParam : 384;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[thumb] fetch failed:", msg);
    return new NextResponse("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse("Upstream error", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Not an image", { status: 415 });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());

  let optimized: Buffer;
  try {
    optimized = await sharp(buffer)
      .rotate()
      .resize(w, undefined, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    // If sharp fails, serve the original
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return new NextResponse(optimized as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Vary": "Accept",
    },
  });
}

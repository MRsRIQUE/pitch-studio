/**
 * GET /api/video-proxy?url=<encoded-cdn-url>
 *
 * Proxies a video from our R2 CDN and adds CORS headers so the browser
 * can draw frames from it to a canvas (needed for frame capture).
 * Forwards Range headers so seeking stays efficient.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url param", { status: 400 });

  // Security: only proxy our own R2 CDN
  const r2Base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!r2Base || !url.startsWith(r2Base)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const upstreamHeaders: Record<string, string> = {};
  const range = req.headers.get("range");
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: upstreamHeaders });
  } catch {
    return new NextResponse("Failed to fetch from CDN", { status: 502 });
  }

  const resHeaders = new Headers();
  resHeaders.set("Access-Control-Allow-Origin", "*");
  resHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");

  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

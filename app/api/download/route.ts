/**
 * GET /api/download?url=<encoded-url>&filename=<name>
 *
 * Server-side proxy that fetches the asset and returns it with
 * Content-Disposition: attachment so the browser saves it to disk.
 * Only allowed origins are proxied.
 */
import { NextRequest, NextResponse } from "next/server";
import { GUEST_MODE } from "@/lib/guestMode";

const ALLOWED_ORIGINS = [
  process.env.R2_PUBLIC_URL ?? "",
  "https://cdn.kie.ai",
  "https://api.kie.ai",
  "https://replicate.delivery",
  "https://pbxt.replicate.delivery",
].filter(Boolean).map((o) => o.replace(/\/$/, ""));

function isAllowed(url: string): boolean {
  if (GUEST_MODE && url.startsWith("/generated/")) return true; // local disk, served same-origin
  return ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
}

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename") ?? "download";

  if (!url) return new NextResponse("Missing url", { status: 400 });
  if (!isAllowed(url)) return new NextResponse("Forbidden", { status: 403 });

  let fetchUrl = url;
  if (GUEST_MODE && url.startsWith("/generated/")) {
    const resolved = new URL(url, req.nextUrl.origin);
    // Re-check after normalization: rejects "/generated/../api/..." traversal
    // that would otherwise turn this proxy into same-origin SSRF.
    if (!resolved.pathname.startsWith("/generated/")) return new NextResponse("Forbidden", { status: 403 });
    fetchUrl = resolved.toString();
  }

  let upstream: Response;
  try {
    upstream = await fetch(fetchUrl);
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse("Upstream error", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

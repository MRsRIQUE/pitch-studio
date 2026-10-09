/**
 * GET /api/download?url=<encoded-url>&filename=<name>
 *
 * Server-side proxy that fetches the asset and returns it with
 * Content-Disposition: attachment so the browser saves it to disk.
 * Only allowed origins are proxied.
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "cdn.kie.ai",
  "api.kie.ai",
  "replicate.delivery",
  "pbxt.replicate.delivery",
]);

function isAllowed(url: string): boolean {
  if (url.startsWith("/generated/")) return true; // local disk, served same-origin

  // Parse the hostname instead of a `startsWith` string check on the whole URL:
  // "https://cdn.kie.ai.evil.com/..." starts with "https://cdn.kie.ai" as a
  // string, so a naive prefix check would let it through.
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (ALLOWED_HOSTS.has(hostname)) return true;
  // Cloudflare R2 public buckets — workflow templates and character avatars
  // are hosted here (see `lib/templates.ts`), same allowlist `next.config.ts`
  // already trusts for <Image>.
  if (hostname.endsWith(".r2.dev")) return true;
  // kie.ai's temporary result CDN (e.g. tempfile.aiquickdraw.com) — the normal
  // path mirrors these to local disk right after generation (see
  // `settleSuccess` in lib/kieJobPoller.ts), but a transient network error
  // during that mirror falls back to the source URL, which then needs to
  // stay downloadable until a later retry succeeds.
  return hostname.endsWith(".aiquickdraw.com");
}

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename") ?? "download";

  if (!url) return new NextResponse("Missing url", { status: 400 });
  if (!isAllowed(url)) return new NextResponse("Forbidden", { status: 403 });

  let fetchUrl = url;
  if (url.startsWith("/generated/")) {
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

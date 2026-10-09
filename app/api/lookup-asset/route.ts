import { NextRequest, NextResponse } from "next/server";
import { lookupAssetHash } from "@/lib/assetCache";

/**
 * GET /api/lookup-asset?hash=<sha256hex>
 *
 * Returns { cdnUrl: string } if the asset exists in the cache,
 * or { cdnUrl: null } if it needs to be uploaded.
 *
 * Clients call this BEFORE sending large payloads so they can skip
 * the upload entirely when the asset is already in R2.
 */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return NextResponse.json({ cdnUrl: null });
  }

  const cdnUrl = await lookupAssetHash(hash);
  return NextResponse.json({ cdnUrl });
}

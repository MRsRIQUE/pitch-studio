import { NextRequest, NextResponse } from "next/server";
import { processMedia } from "@/lib/productionMedia";
export const runtime = "nodejs";
export const maxDuration = 1200;
export async function POST(req: NextRequest) {
  try { return NextResponse.json(await processMedia(await req.json())); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no processamento." }, { status: 400 }); }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { processMedia } from "@/lib/productionMedia";

export const runtime = "nodejs";
// Limite das funções da Vercel (plano Pro). Render mais longo que isso não cabe.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try { return NextResponse.json(await processMedia(await req.json(), user.uid)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no processamento." }, { status: 400 }); }
}

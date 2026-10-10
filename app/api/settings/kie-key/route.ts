/**
 * No Studio hospedado a chave da kie.ai é do servidor (`KIE_API_KEY`), nunca
 * do usuário. GET responde "conectado" para as telas que ainda perguntam;
 * gravar ou apagar chave não existe mais.
 */
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ hasToken: true });
}

export async function POST() {
  return NextResponse.json({ error: "A chave é gerenciada pelo SaySell." }, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json({ error: "A chave é gerenciada pelo SaySell." }, { status: 403 });
}

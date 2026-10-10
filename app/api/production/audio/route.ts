/**
 * Áudio (ElevenLabs: fala, música, efeitos, isolamento, clonagem de voz).
 *
 * Fora do v1 do Studio hospedado: o custo do ElevenLabs não está na tabela de
 * créditos, e gerar sem cobrar abriria um gasto sem teto. A rota responde
 * "em breve" e o nó de áudio mostra a mensagem. A implementação local do
 * HeliosGen está no histórico do git (commit 4024669) para quando o preço
 * entrar no sistema de créditos.
 */
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

const EM_BREVE = "O estúdio de áudio chega em breve ao SaySell Studio.";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ elevenlabs: false, kie: false, clonedVoices: [], voices: [], indisponivel: EM_BREVE });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ error: EM_BREVE }, { status: 503 });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ error: EM_BREVE }, { status: 503 });
}

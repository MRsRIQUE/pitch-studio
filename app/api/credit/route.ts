/**
 * Saldo de créditos do Studio para a barra lateral e o cromo do workflow.
 * Vem do saysell-web (franquia do mês + pacotes); o formato `{ data: número }`
 * é o que `hooks/useCreditos.ts` já lê.
 */
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { SaySellUnavailable, getStudioMe } from "@/lib/saysell/client";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const me = await getStudioMe(user.uid);
    return NextResponse.json({ data: me.balance.total, balance: me.balance, level: me.level });
  } catch (error) {
    if (!(error instanceof SaySellUnavailable)) console.error("[credit]", error);
    return NextResponse.json({ error: "Saldo indisponível no momento." }, { status: 503 });
  }
}

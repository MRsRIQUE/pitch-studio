/**
 * Aceite da cláusula de créditos do Studio, uma vez por versão. O Studio só
 * repassa versão e hash do texto que mostrou; a prova fica no saysell-web.
 */
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { SaySellUnavailable, acceptCreditsTerms } from "@/lib/saysell/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !body ||
    body.accepted !== true ||
    typeof body.version !== "string" ||
    typeof body.sha256 !== "string"
  ) {
    return NextResponse.json({ error: "Marque o aceite para continuar." }, { status: 400 });
  }
  try {
    const result = await acceptCreditsTerms(user.uid, {
      version: body.version,
      sha256: body.sha256,
    });
    if (result === "stale") {
      return NextResponse.json(
        { error: "A cláusula foi atualizada. Recarregue a página para ler a versão vigente." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!(error instanceof SaySellUnavailable)) console.error("[credit/terms]", error);
    return NextResponse.json({ error: "Não deu para registrar o aceite agora." }, { status: 503 });
  }
}

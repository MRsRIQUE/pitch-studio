/**
 * Troca o ID token do Firebase por cookie de sessão do Studio.
 *
 *   POST   { idToken } → 200 { ok: true } + Set-Cookie
 *   DELETE             → 200 { ok: true } e o cookie apagado
 */
import { NextRequest, NextResponse } from "next/server";
import { InvalidIdToken, verifyIdToken } from "@/lib/auth/idToken";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, encodeSession, newSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = (await req.json()) as { idToken?: unknown });
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const user = await verifyIdToken(idToken);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, encodeSession(newSession(user.uid, user.email)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (error) {
    if (error instanceof InvalidIdToken) {
      return NextResponse.json({ error: "Login inválido. Entre de novo." }, { status: 401 });
    }
    console.error("[session] falha ao criar sessão:", error);
    return NextResponse.json({ error: "Login indisponível no momento." }, { status: 503 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

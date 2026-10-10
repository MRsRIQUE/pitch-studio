/**
 * Link público, somente leitura, de um projeto.
 *
 *   POST   { spaceId } → cria o link (precisa de sessão)
 *   GET    ?token=     → devolve o projeto (público — o proxy deixa passar)
 *   DELETE { token }   → revoga o link (precisa de sessão e ser o dono)
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";

export const runtime = "nodejs";

const TOKEN = /^[a-f0-9]{48}$/;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { spaceId } = await req.json();
  const store = await data();
  if (!(await store.getSpaces(user.uid)).some((s) => s.id === spaceId)) {
    return NextResponse.json({ error: "Salve o projeto antes de compartilhar." }, { status: 404 });
  }
  const token = randomBytes(24).toString("hex");
  await store.createShare(token, user.uid, String(spaceId));
  return NextResponse.json({ path: `/share/${token}`, token });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  const store = await data();
  const share = await store.getShare(token);
  const space = share ? (await store.getSpaces(share.uid)).find((s) => s.id === share.spaceId) : undefined;
  if (!space) return NextResponse.json({ error: "Compartilhamento indisponível." }, { status: 404 });
  return NextResponse.json({ space }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { token } = await req.json();
  if (!TOKEN.test(token ?? "")) return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  await (await data()).deleteShare(user.uid, token);
  return NextResponse.json({ ok: true });
}

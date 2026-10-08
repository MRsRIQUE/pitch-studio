import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting } from "@/lib/guest/db";
import { getSpaces } from "@/lib/guest/spaces";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { spaceId } = await req.json();
  if (!getSpaces().some(s => s.id === spaceId)) return NextResponse.json({ error: "Salve o projeto antes de compartilhar." }, { status: 404 });
  const token = randomBytes(24).toString("hex"); setSetting(`workflow-share:${token}`, spaceId);
  return NextResponse.json({ path: `/share/${token}`, token });
}
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{48}$/.test(token)) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  const spaceId = getSetting(`workflow-share:${token}`), space = getSpaces().find(s => s.id === spaceId);
  if (!space) return NextResponse.json({ error: "Compartilhamento indisponível." }, { status: 404 });
  return NextResponse.json({ space }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: NextRequest) { const { token } = await req.json(); if (!/^[a-f0-9]{48}$/.test(token ?? "")) return NextResponse.json({ error: "Token inválido" }, { status: 400 }); setSetting(`workflow-share:${token}`, ""); return NextResponse.json({ ok: true }); }

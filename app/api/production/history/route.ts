import { NextRequest, NextResponse } from "next/server";
import { getUploads, getGenerations, deleteUpload, deleteGeneration } from "@/lib/guest/db";
import { GUEST_USER_ID } from "@/lib/guestMode";
export async function GET() {
  const uploads = ["image", "video", "audio"].flatMap(kind => getUploads(GUEST_USER_ID, kind).map(a => ({ id: a.id, url: a.r2_url, kind, name: a.source === "production" ? "Produção" : "Upload", source: "upload", createdAt: new Date(a.created_at).getTime() })));
  const generations = (["image", "video"] as const).flatMap(kind => getGenerations(GUEST_USER_ID, kind).filter(g => g.status === "done").map(g => ({ id: g.id, url: g.video_url || g.image_url, kind, name: g.prompt || g.model || "Geração", source: "generation", createdAt: new Date(g.created_at).getTime() })));
  return NextResponse.json({ items: [...uploads, ...generations].filter(a => a.url).sort((a, b) => b.createdAt - a.createdAt) });
}
export async function DELETE(req: NextRequest) { const { items } = await req.json(); if (!Array.isArray(items) || items.length > 10) return NextResponse.json({ error: "Selecione até 10 itens." }, { status: 400 }); for (const item of items) { if (item.source === "generation") deleteGeneration(item.id, GUEST_USER_ID); else deleteUpload(item.id, GUEST_USER_ID); } return NextResponse.json({ ok: true }); }

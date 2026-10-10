import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const store = await data();
  const uploads = (
    await Promise.all(
      (["image", "video", "audio"] as const).map(async (kind) =>
        (await store.getUploads(user.uid, kind)).map((a) => ({
          id: a.id,
          url: a.r2_url,
          kind,
          name: a.source === "production" ? "Produção" : "Upload",
          source: "upload",
          createdAt: new Date(a.created_at).getTime(),
        })),
      ),
    )
  ).flat();
  const generations = (
    await Promise.all(
      (["image", "video"] as const).map(async (kind) =>
        (await store.getGenerations(user.uid, kind))
          .filter((g) => g.status === "done")
          .map((g) => ({
            id: g.id,
            url: g.video_url || g.image_url,
            kind,
            name: g.prompt || g.model || "Geração",
            source: "generation",
            createdAt: new Date(g.created_at).getTime(),
          })),
      ),
    )
  ).flat();
  return NextResponse.json({
    items: [...uploads, ...generations].filter((a) => a.url).sort((a, b) => b.createdAt - a.createdAt),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { items } = await req.json();
  if (!Array.isArray(items) || items.length > 10) {
    return NextResponse.json({ error: "Selecione até 10 itens." }, { status: 400 });
  }
  const store = await data();
  for (const item of items) {
    if (item.source === "generation") await store.deleteGeneration(user.uid, String(item.id));
    else await store.deleteUpload(user.uid, String(item.id));
  }
  return NextResponse.json({ ok: true });
}

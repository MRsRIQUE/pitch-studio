import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";

async function readBody(req: NextRequest) {
  const body = await req.json() as { folderId: string; itemIds: string[] };
  const { folderId, itemIds } = body;
  return folderId && Array.isArray(itemIds) ? { folderId, itemIds } : null;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Missing folderId or itemIds" }, { status: 400 });
  await (await data()).insertFolderItems(user.uid, body.folderId, body.itemIds);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Missing folderId or itemIds" }, { status: 400 });
  await (await data()).deleteFolderItems(user.uid, body.folderId, body.itemIds);
  return NextResponse.json({ ok: true });
}

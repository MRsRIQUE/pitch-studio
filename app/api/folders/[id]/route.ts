import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json() as { name?: string; parentId?: string | null; orderIndex?: number; color?: string | null };

  await (await data()).updateFolder(user.uid, id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.parentId !== undefined ? { parent_id: body.parentId ?? null } : {}),
    ...(body.orderIndex !== undefined ? { order_index: body.orderIndex } : {}),
    ...(body.color !== undefined ? { color: body.color } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  await (await data()).deleteFolder(user.uid, id);
  return NextResponse.json({ ok: true });
}

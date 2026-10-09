import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const store = await data();
  const [folders, folderItems] = await Promise.all([store.getFolders(user.uid), store.getFolderItems(user.uid)]);
  return NextResponse.json({ folders, folderItems });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = await req.json() as { name: string; parentId?: string | null; orderIndex?: number };
  const { name, parentId = null, orderIndex = 0 } = body;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const folder = await (await data()).insertFolder(user.uid, {
    id: randomUUID(),
    name,
    parent_id: parentId ?? null,
    order_index: orderIndex,
  });
  return NextResponse.json({ folder });
}

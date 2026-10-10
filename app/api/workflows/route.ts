/**
 * Projetos (workflows, "spaces") do usuário — camada de dados (`lib/data`).
 *
 *   GET  → { spaces: StudioSpace[] }
 *   PUT  { spaces: StudioSpace[] } → { ok: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { SpaceTooLarge, data, type StudioSpace } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ spaces: await (await data()).getSpaces(user.uid) });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  let body: { spaces?: StudioSpace[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.spaces)) {
    return NextResponse.json({ error: "spaces[] required" }, { status: 400 });
  }

  try {
    await (await data()).saveSpaces(user.uid, body.spaces);
  } catch (error) {
    if (error instanceof SpaceTooLarge) {
      return NextResponse.json({ error: error.message, spaceId: error.spaceId }, { status: 413 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}

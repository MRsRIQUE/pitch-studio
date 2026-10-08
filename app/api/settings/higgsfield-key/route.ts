import { NextRequest, NextResponse } from "next/server";
import {
  deleteHiggsfieldCredentials,
  getHiggsfieldCredentials,
  setHiggsfieldCredentials,
} from "@/lib/guest/db";

export async function GET() {
  return NextResponse.json({ hasCredentials: Boolean(getHiggsfieldCredentials()) });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { keyId?: unknown; keySecret?: unknown };
  const clean = (value: unknown) => typeof value === "string"
    ? value.trim().replace(/^authorization\s*:\s*/i, "").replace(/^key\s+/i, "").trim()
    : "";
  let keyId = clean(body.keyId);
  let keySecret = clean(body.keySecret);

  // The console often presents the authorization value as KEY_ID:KEY_SECRET.
  // Accept that value in either field while continuing to store the two parts.
  const combined = !keySecret && keyId.includes(":")
    ? keyId
    : !keyId && keySecret.includes(":")
      ? keySecret
      : "";
  if (combined) {
    const separator = combined.indexOf(":");
    keyId = combined.slice(0, separator).trim();
    keySecret = combined.slice(separator + 1).trim();
  }

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Informe o Key ID e o Key Secret, ou cole KEY_ID:KEY_SECRET em um dos campos." },
      { status: 400 },
    );
  }
  if (keyId.includes(":") || keySecret.includes(":") || keyId.length > 500 || keySecret.length > 500) {
    return NextResponse.json(
      { error: "Formato inválido. Não inclua 'Authorization: Key'; use somente o Key ID e o Key Secret." },
      { status: 400 },
    );
  }
  setHiggsfieldCredentials(keyId, keySecret);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  deleteHiggsfieldCredentials();
  return NextResponse.json({ ok: true });
}

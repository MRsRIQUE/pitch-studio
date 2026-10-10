/**
 * Quem está chamando. Route handlers usam `getSessionUser()` e devolvem
 * `unauthorized()` quando vier `null`; o `proxy.ts` já barra quem não tem
 * cookie, então aqui é a checagem de verdade (assinatura e validade).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, decodeSession, devSession, type StudioSession } from "./session";

export async function getSessionUser(): Promise<StudioSession | null> {
  const dev = devSession();
  if (dev) return dev;
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 });
}

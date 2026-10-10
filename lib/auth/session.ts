/**
 * A sessão do Studio: um cookie assinado com HMAC-SHA256.
 *
 * O login acontece no navegador com o Firebase Auth do SaySell; o ID token
 * dele é validado uma vez no servidor (`app/api/session`) e trocado por este
 * cookie. Daí em diante toda rota — inclusive o `EventSource` do status do job,
 * que não manda header de autorização — lê o usuário do cookie.
 *
 * Roda no `proxy.ts` e nos route handlers; os dois usam o runtime Node.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ss_studio_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** O formato dos uids do Firebase Auth (28 alfanuméricos), com folga. */
export const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type StudioSession = { uid: string; email: string | null; exp: number };

function sessionSecret(): string | null {
  const value = process.env.STUDIO_SESSION_SECRET?.trim() || "";
  return value.length >= 32 ? value : null;
}

const sign = (payload: string, key: string) =>
  createHmac("sha256", key).update(payload).digest("base64url");

export function newSession(uid: string, email: string | null, now = Date.now()): StudioSession {
  return { uid, email, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
}

export function encodeSession(session: StudioSession, key = sessionSecret()): string {
  if (!key) throw new Error("STUDIO_SESSION_SECRET ausente ou com menos de 32 caracteres");
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/** `null` para cookie ausente, adulterado, malformado ou vencido. */
export function decodeSession(
  value: string | null | undefined,
  now = Date.now(),
  key = sessionSecret(),
): StudioSession | null {
  if (!value || !key) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, key), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof data.uid !== "string" || !UID_PATTERN.test(data.uid)) return null;
    if (typeof data.exp !== "number" || data.exp * 1000 <= now) return null;
    return { uid: data.uid, email: typeof data.email === "string" ? data.email : null, exp: data.exp };
  } catch {
    return null;
  }
}

/**
 * Desenvolvimento local: `STUDIO_DEV_USER=<uid>` entra sem login. Nunca na
 * Vercel — lá a variável é ignorada mesmo se alguém a cadastrar.
 */
export function devSession(): StudioSession | null {
  if (process.env.VERCEL) return null;
  const uid = process.env.STUDIO_DEV_USER?.trim() || "";
  if (!UID_PATTERN.test(uid)) return null;
  return { uid, email: null, exp: Number.MAX_SAFE_INTEGER };
}

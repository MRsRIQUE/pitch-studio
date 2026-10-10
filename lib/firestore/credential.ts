/**
 * Conta de serviço do Firestore do SaySell → access token OAuth.
 *
 * Mesmo desenho de `lib/pitchai/credencial.ts` (sem firebase-admin: `crypto`
 * assina o JWT e `fetch` troca pelo token), apontado para o projeto do
 * SaySell. `FIREBASE_SERVICE_ACCOUNT` — o mesmo nome do saysell-web — aceita:
 *
 *   1. o JSON inteiro inline
 *   2. o JSON em base64
 *   3. caminho para o .json
 *
 * Nada aqui é `NEXT_PUBLIC_`: a conta assina como administrador do projeto.
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MARGIN_MS = 60_000;

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export class MissingFirestoreCredential extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "MissingFirestoreCredential";
  }
}

export function hasFirestoreCredential(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());
}

let account: ServiceAccount | null = null;

function readAccount(): ServiceAccount {
  if (account) return account;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new MissingFirestoreCredential("FIREBASE_SERVICE_ACCOUNT não está definida.");
  let text: string;
  if (raw.startsWith("{")) text = raw;
  else if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 200) text = Buffer.from(raw, "base64").toString("utf8");
  else {
    try {
      text = readFileSync(raw, "utf8");
    } catch {
      throw new MissingFirestoreCredential(`Não consegui ler a conta de serviço em ${raw}.`);
    }
  }
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(text) as Partial<ServiceAccount>;
  } catch {
    throw new MissingFirestoreCredential("FIREBASE_SERVICE_ACCOUNT não é um JSON válido.");
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new MissingFirestoreCredential("Conta de serviço incompleta (project_id, client_email, private_key).");
  }
  account = parsed as ServiceAccount;
  return account;
}

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

let cached: { token: string; expires: number } | null = null;

export async function firestoreToken(): Promise<string> {
  if (cached && Date.now() < cached.expires - MARGIN_MS) return cached.token;
  const sa = readAccount();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(sa.private_key, "base64url")}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new MissingFirestoreCredential(
      `O Google recusou a conta de serviço: ${data.error_description ?? `HTTP ${res.status}`}`,
    );
  }
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** `projects/<id>/databases/<db>` do banco do SaySell. */
export function databaseRoot(): string {
  const project = process.env.FIREBASE_PROJECT_ID?.trim() || readAccount().project_id;
  const database = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";
  return `projects/${project}/databases/${database}`;
}

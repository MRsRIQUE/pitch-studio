/**
 * Valida um ID token do Firebase Auth do SaySell pelo Identity Toolkit — o
 * mesmo caminho do `verifyFirebaseIdToken` do saysell-web. Só precisa da API
 * key pública do projeto, não da conta de serviço.
 */

export type VerifiedUser = { uid: string; email: string | null };

export class InvalidIdToken extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "InvalidIdToken";
  }
}

export async function verifyIdToken(idToken: string): Promise<VerifiedUser> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY não está definida");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; email?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new InvalidIdToken(body.error?.message ?? `HTTP ${res.status}`);
  const user = body.users?.[0];
  if (!user?.localId) throw new InvalidIdToken("token sem usuário");
  return { uid: user.localId, email: user.email ?? null };
}

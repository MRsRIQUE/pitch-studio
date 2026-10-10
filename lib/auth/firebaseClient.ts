/**
 * Firebase Auth do SaySell no navegador — só para o login. Os valores são os
 * públicos do projeto (os mesmos do `firebase-applet-config.json` do
 * saysell-web), vindos de `NEXT_PUBLIC_FIREBASE_*`.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new Error("Login não configurado: faltam as variáveis NEXT_PUBLIC_FIREBASE_*.");
  }
  return initializeApp({ apiKey, authDomain, projectId });
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

/** Troca o ID token do Firebase pelo cookie de sessão do Studio. */
export async function abrirSessao(idToken: string): Promise<void> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? "Não foi possível entrar agora.");
  }
}

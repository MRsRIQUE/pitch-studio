/**
 * Escolhe a camada de dados: Firestore do SaySell quando há conta de serviço,
 * SQLite local só fora da Vercel. Na Vercel sem credencial é erro — nunca um
 * banco em disco efêmero que perderia tudo no próximo deploy.
 */
import { hasFirestoreCredential } from "@/lib/firestore/credential";
import { firestoreData } from "./firestore";
import type { StudioData } from "./types";

export * from "./types";

let chosen: StudioData | null = null;

export async function data(): Promise<StudioData> {
  if (chosen) return chosen;
  if (hasFirestoreCredential()) {
    chosen = firestoreData;
  } else if (process.env.VERCEL) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT não está definida na Vercel.");
  } else {
    // Import tardio: `node:sqlite` só carrega em desenvolvimento.
    chosen = (await import("./sqlite")).sqliteData;
  }
  return chosen;
}

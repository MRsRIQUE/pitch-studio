/**
 * Carteira de desenvolvimento: substitui o saysell-web quando o Studio roda
 * na máquina sem `SAYSELL_API_URL`. Nível vem de `STUDIO_DEV_LEVEL`
 * (`all` por padrão), saldo em memória do processo. Nunca roda na Vercel —
 * `client.ts` só chega aqui quando `VERCEL` não existe.
 */
import type { ReserveInput, ReserveResult, SettleOutcome, StudioLevel, StudioMe } from "./client";

type DevReservation = { credits: number; status: "reserved" | SettleOutcome };

const globalForDev = globalThis as unknown as {
  __studioDevWallet?: Map<string, { used: number; reservations: Map<string, DevReservation> }>;
};
const wallets = (globalForDev.__studioDevWallet ??= new Map());

function level(): StudioLevel {
  const raw = process.env.STUDIO_DEV_LEVEL?.trim();
  return raw === "none" || raw === "selected" ? raw : "all";
}

const monthly = () => (level() === "all" ? 4_000 : level() === "selected" ? 1_200 : 0);

function walletOf(uid: string) {
  let w = wallets.get(uid);
  if (!w) {
    w = { used: 0, reservations: new Map() };
    wallets.set(uid, w);
  }
  return w;
}

export function devGetMe(uid: string): StudioMe {
  const w = walletOf(uid);
  const left = Math.max(0, monthly() - w.used);
  return {
    level: level(),
    monthlyCredits: monthly(),
    period: new Date().toISOString().slice(0, 7),
    balance: { monthly: left, pack: 0, total: left },
  };
}

export function devReserve(uid: string, input: ReserveInput): ReserveResult {
  if (level() === "none") return { ok: false, reason: "studio_not_in_plan" };
  const w = walletOf(uid);
  if (w.reservations.has(input.jobId)) return { ok: false, reason: "job_conflict" };
  if (monthly() - w.used < input.credits) return { ok: false, reason: "insufficient_credits" };
  w.used += input.credits;
  w.reservations.set(input.jobId, { credits: input.credits, status: "reserved" });
  return { ok: true, balance: devGetMe(uid).balance };
}

export function devSettle(uid: string, jobId: string, outcome: SettleOutcome): void {
  const w = walletOf(uid);
  const r = w.reservations.get(jobId);
  if (!r || r.status !== "reserved") return;
  r.status = outcome;
  if (outcome === "refunded") w.used = Math.max(0, w.used - r.credits);
}

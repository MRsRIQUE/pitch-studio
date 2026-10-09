/**
 * Carteira de desenvolvimento: substitui o saysell-web quando o Studio roda
 * na máquina sem `SAYSELL_API_URL`. Nível vem de `STUDIO_DEV_LEVEL`
 * (`all` por padrão), saldo em memória do processo. Nunca roda na Vercel —
 * `client.ts` só chega aqui quando `VERCEL` não existe.
 *
 * Espelha a regra de modelos do saysell-web (`src/lib/studio/policy.ts`) só
 * para o dev ver as mesmas recusas que produção. A regra que vale é a de lá.
 */
import type {
  ReserveDenyReason,
  ReserveInput,
  ReserveResult,
  SettleOutcome,
  StudioLevel,
  StudioMe,
} from "./client";

type DevReservation = { credits: number; status: "reserved" | SettleOutcome };

const globalForDev = globalThis as unknown as {
  __studioDevWallet?: Map<string, { used: number; reservations: Map<string, DevReservation> }>;
};
const wallets = (globalForDev.__studioDevWallet ??= new Map());

const SELECTED_MODELS = new Set([
  "nano-banana-2", "nano-banana-2-lite", "google-nano-banana", "seedream-5-lite", "gpt-image-2",
  "z-image", "grok-imagine-image", "veo3_lite", "veo3_fast", "seedance-2-mini", "seedance-2-fast",
  "grok-imagine", "grok-imagine-1-5-preview",
]);
const SELECTED_CHAT_MODELS = new Set(["gemini-3-flash"]);
const VIDEO_RANK: Record<string, number> = { "480p": 1, "720p": 2, "768p": 2, "1080p": 3, "2k": 4, "4k": 5 };
const IMAGE_RANK: Record<string, number> = { "1k": 1, "1.5k": 1, "2k": 2, "4k": 3 };

function level(): StudioLevel {
  const raw = process.env.STUDIO_DEV_LEVEL?.trim();
  return raw === "none" || raw === "selected" ? raw : "all";
}

const monthly = () => (level() === "all" ? 4_000 : level() === "selected" ? 1_200 : 0);

function denyFor(input: ReserveInput): ReserveDenyReason | null {
  const lv = level();
  if (lv === "none") return "studio_not_in_plan";
  if (input.model.startsWith("higgsfield-")) return "model_blocked";
  if (lv === "all") return null;
  if (input.kind === "chat") return SELECTED_CHAT_MODELS.has(input.model) ? null : "model_requires_max";
  if (!SELECTED_MODELS.has(input.model)) return "model_requires_max";
  const rank = (input.kind === "video" ? VIDEO_RANK : IMAGE_RANK)[input.resolution.trim().toLowerCase()];
  return rank === undefined || rank > 2 ? "resolution_requires_max" : null;
}

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
    balance: { monthly: left, pack: 0, total: left, debt: 0 },
  };
}

export function devReserve(uid: string, input: ReserveInput): ReserveResult {
  const deny = denyFor(input);
  if (deny) return { ok: false, reason: deny };
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

/**
 * Cliente das rotas `/api/studio/*` do saysell-web: plano, saldo e débito de
 * créditos. O saysell-web é a única autoridade de acesso e saldo; o Studio
 * nunca grava na carteira.
 *
 * Contrato (saysell-web, `docs/superpowers/plans/2026-10-08-studio-a-acesso-creditos.md`):
 *   headers  x-saysell-studio-key: STUDIO_SERVICE_KEY, x-saysell-uid: <uid>
 *   GET  /api/studio/me       → { ok, level, monthlyCredits, period, balance }
 *   POST /api/studio/reserve  → 200 | 402 insufficient_credits | 403 <motivo> | 409 job_conflict
 *   POST /api/studio/settle   → 200 | 404 not_found | 409 already_settled
 *
 * Fora da Vercel, sem `SAYSELL_API_URL`, entra a carteira de desenvolvimento
 * (`devWallet.ts`). Na Vercel a falta de configuração é erro, nunca carteira falsa.
 */
import { devGetMe, devReserve, devSettle } from "./devWallet";

export type StudioLevel = "none" | "selected" | "all";
export type StudioBalance = { monthly: number; pack: number; total: number };
export type StudioMe = {
  level: StudioLevel;
  monthlyCredits: number;
  period: string;
  balance: StudioBalance;
};
export type CreditKind = "image" | "video" | "chat";
export type ReserveInput = {
  jobId: string;
  credits: number;
  model: string;
  kind: CreditKind;
  resolution: string;
};
export type ReserveDenyReason =
  | "insufficient_credits"
  | "studio_not_in_plan"
  | "model_blocked"
  | "model_requires_max"
  | "resolution_requires_max"
  | "job_conflict";
export type ReserveResult =
  | { ok: true; balance: StudioBalance }
  | { ok: false; reason: ReserveDenyReason };
export type SettleOutcome = "committed" | "refunded";

export class SaySellUnavailable extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "SaySellUnavailable";
  }
}

type Config = { base: string; key: string } | "dev";

function config(): Config {
  const base = process.env.SAYSELL_API_URL?.trim().replace(/\/+$/, "") || "";
  const key = process.env.STUDIO_SERVICE_KEY?.trim() || "";
  if (base && key.length >= 32) return { base, key };
  if (!process.env.VERCEL) return "dev";
  throw new SaySellUnavailable("SAYSELL_API_URL ou STUDIO_SERVICE_KEY não configurados");
}

async function call(
  cfg: { base: string; key: string },
  uid: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${cfg.base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        "x-saysell-studio-key": cfg.key,
        "x-saysell-uid": uid,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new SaySellUnavailable(`saysell-web inacessível: ${(error as Error).message}`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status >= 500 || res.status === 401) {
    throw new SaySellUnavailable(`saysell-web respondeu ${res.status}`);
  }
  return { status: res.status, data };
}

function readBalance(value: unknown): StudioBalance {
  const b = (value ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { monthly: n(b.monthly), pack: n(b.pack), total: n(b.total) };
}

export async function getStudioMe(uid: string): Promise<StudioMe> {
  const cfg = config();
  if (cfg === "dev") return devGetMe(uid);
  const { status, data } = await call(cfg, uid, "/api/studio/me");
  if (status !== 200 || data.ok !== true) throw new SaySellUnavailable(`me respondeu ${status}`);
  const level = data.level === "selected" || data.level === "all" ? data.level : "none";
  return {
    level,
    monthlyCredits: typeof data.monthlyCredits === "number" ? data.monthlyCredits : 0,
    period: typeof data.period === "string" ? data.period : "",
    balance: readBalance(data.balance),
  };
}

const DENY: ReadonlySet<string> = new Set([
  "insufficient_credits",
  "studio_not_in_plan",
  "model_blocked",
  "model_requires_max",
  "resolution_requires_max",
  "job_conflict",
]);

export async function reserveCredits(uid: string, input: ReserveInput): Promise<ReserveResult> {
  const cfg = config();
  if (cfg === "dev") return devReserve(uid, input);
  const { status, data } = await call(cfg, uid, "/api/studio/reserve", input);
  if (status === 200 && data.ok === true) return { ok: true, balance: readBalance(data.balance) };
  const reason = typeof data.reason === "string" && DENY.has(data.reason) ? data.reason : null;
  if (!reason) throw new SaySellUnavailable(`reserve respondeu ${status} sem motivo conhecido`);
  return { ok: false, reason: reason as ReserveDenyReason };
}

/**
 * Encerra a reserva. `already_settled` com o mesmo desfecho é sucesso (o
 * saysell-web devolve 200 nesse caso); `not_found` é registrado e ignorado,
 * porque não há o que estornar.
 */
export async function settleCredits(
  uid: string,
  jobId: string,
  outcome: SettleOutcome,
): Promise<void> {
  const cfg = config();
  if (cfg === "dev") return devSettle(uid, jobId, outcome);
  const { status, data } = await call(cfg, uid, "/api/studio/settle", { jobId, outcome });
  if (status === 200) return;
  console.warn(`[saysell] settle ${outcome} de ${jobId} respondeu ${status}: ${String(data.reason)}`);
}

/** Mensagem em pt-BR para cada recusa, mostrada ao usuário. */
export function reserveDenyMessage(reason: ReserveDenyReason): string {
  switch (reason) {
    case "insufficient_credits":
      return "Seus créditos acabaram. Compre um pacote para continuar gerando.";
    case "studio_not_in_plan":
      return "O Studio faz parte dos planos Pro e Max.";
    case "model_blocked":
      return "Este modelo ainda não está disponível no Studio.";
    case "model_requires_max":
      return "Este modelo é exclusivo do plano Max.";
    case "resolution_requires_max":
      return "Esta resolução é exclusiva do plano Max.";
    case "job_conflict":
      return "Esta geração já foi enviada. Atualize a tela.";
  }
}

/** Status HTTP que a rota do Studio devolve ao navegador para cada recusa. */
export function reserveDenyStatus(reason: ReserveDenyReason): number {
  if (reason === "insufficient_credits") return 402;
  if (reason === "job_conflict") return 409;
  return 403;
}

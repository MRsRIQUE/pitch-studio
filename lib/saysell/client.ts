/**
 * Cliente das rotas `/api/studio/*` do saysell-web: plano, saldo e débito de
 * créditos. O saysell-web é a única autoridade de acesso e saldo; o Studio
 * nunca grava na carteira.
 *
 * Contrato (saysell-web, `docs/superpowers/plans/2026-10-08-studio-a-acesso-creditos.md`):
 *   headers  x-saysell-studio-key: STUDIO_SERVICE_KEY, x-saysell-uid: <uid>
 *   GET  /api/studio/me       → { ok, level, monthlyCredits, period, balance, creditsTerms }
 *   POST /api/studio/reserve  → 200 | 402 insufficient_credits | 403 <motivo> | 409 job_conflict
 *   POST /api/studio/terms    → 200 | 409 terms_stale (aceite da cláusula de créditos)
 *   POST /api/studio/settle   → 200 | 404 not_found | 409 already_settled
 *
 * Fora da Vercel, sem `SAYSELL_API_URL`, entra a carteira de desenvolvimento
 * (`devWallet.ts`). Na Vercel a falta de configuração é erro, nunca carteira falsa.
 */
import { devAcceptTerms, devGetMe, devReserve, devSettle } from "./devWallet";

export type StudioLevel = "none" | "selected" | "all";
/** `debt`: créditos devidos por estorno de algo já usado; enquanto > 0, não gera. */
export type StudioBalance = { monthly: number; pack: number; total: number; debt: number };
/**
 * Cláusula de créditos que precisa ser aceita uma vez antes de gerar. `null`
 * quando o saysell-web não pede aceite (versão anterior da API).
 */
export type CreditsTerms = { accepted: boolean; version: string; text: string; sha256: string };
export type StudioMe = {
  level: StudioLevel;
  monthlyCredits: number;
  period: string;
  balance: StudioBalance;
  creditsTerms: CreditsTerms | null;
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
  | "credit_debt"
  | "studio_not_in_plan"
  | "model_blocked"
  | "model_requires_max"
  | "resolution_requires_max"
  | "terms_required"
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

function readCreditsTerms(value: unknown): CreditsTerms | null {
  const t = (value ?? null) as Record<string, unknown> | null;
  if (
    !t ||
    typeof t.accepted !== "boolean" ||
    typeof t.version !== "string" ||
    typeof t.text !== "string" ||
    typeof t.sha256 !== "string"
  ) {
    return null;
  }
  return { accepted: t.accepted, version: t.version, text: t.text, sha256: t.sha256 };
}

function readBalance(value: unknown): StudioBalance {
  const b = (value ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { monthly: n(b.monthly), pack: n(b.pack), total: n(b.total), debt: n(b.debt) };
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
    creditsTerms: readCreditsTerms(data.creditsTerms),
  };
}

/** Registra no saysell-web o aceite da cláusula que o Studio mostrou. */
export async function acceptCreditsTerms(
  uid: string,
  shown: { version: string; sha256: string },
): Promise<"ok" | "stale"> {
  const cfg = config();
  if (cfg === "dev") return devAcceptTerms(uid, shown);
  const { status, data } = await call(cfg, uid, "/api/studio/terms", { accepted: true, ...shown });
  if (status === 200 && data.ok === true) return "ok";
  if (status === 409) return "stale";
  throw new SaySellUnavailable(`terms respondeu ${status}`);
}

const DENY: ReadonlySet<string> = new Set([
  "insufficient_credits",
  "credit_debt",
  "studio_not_in_plan",
  "model_blocked",
  "model_requires_max",
  "resolution_requires_max",
  "terms_required",
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
      return "Seus créditos acabaram. Compre um pacote em saysell.app/studio/creditos para continuar gerando.";
    case "credit_debt":
      return "Há créditos devidos de um pagamento estornado. As gerações voltam quando a franquia do próximo mês ou um novo pacote cobrir o saldo devedor.";
    case "studio_not_in_plan":
      return "O Studio faz parte dos planos Pro e Max.";
    case "model_blocked":
      return "Este modelo ainda não está disponível no Studio.";
    case "model_requires_max":
      return "Este modelo é exclusivo do plano Max.";
    case "resolution_requires_max":
      return "Esta resolução é exclusiva do plano Max.";
    case "terms_required":
      return "Antes de gerar, aceite a cláusula de créditos do Studio. Atualize a página.";
    case "job_conflict":
      return "Esta geração já foi enviada. Atualize a tela.";
  }
}

/** Status HTTP que a rota do Studio devolve ao navegador para cada recusa. */
export function reserveDenyStatus(reason: ReserveDenyReason): number {
  if (reason === "insufficient_credits" || reason === "credit_debt") return 402;
  if (reason === "job_conflict") return 409;
  return 403;
}

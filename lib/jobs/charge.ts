/**
 * Cobrança de uma geração em créditos do Studio, antes de chamar o provedor.
 *
 * O custo sai da mesma tabela que a tela mostra (`estimateGenerationCost`,
 * créditos kie.ai) e usa o teto da faixa, arredondado para cima: a reserva
 * nunca fica abaixo do que a kie.ai vai cobrar. Configuração sem preço
 * conhecido não é gerada — melhor recusar do que gerar sem saber o custo.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { estimateGenerationCost, type CostOptions } from "@/lib/generationCost";
import {
  SaySellUnavailable,
  reserveCredits,
  reserveDenyMessage,
  reserveDenyStatus,
  settleCredits,
  type CreditKind,
} from "@/lib/saysell/client";

export type Charge = { ok: true; creditJobId: string; credits: number } | { ok: false; response: NextResponse };

/** Créditos a reservar, ou `null` se a tabela não tem preço para isso. */
export function creditsFor(cost: CostOptions): number | null {
  const estimate = estimateGenerationCost(cost);
  const max = estimate.credits?.max;
  return typeof max === "number" && Number.isFinite(max) && max > 0 ? Math.ceil(max) : null;
}

export async function chargeGeneration(
  uid: string,
  input: { kind: CreditKind; model: string; resolution: string; credits: number | null },
): Promise<Charge> {
  if (input.credits === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Não foi possível calcular o custo desta configuração. Escolha outra duração ou resolução." },
        { status: 400 },
      ),
    };
  }
  const creditJobId = `gen_${randomUUID()}`;
  try {
    const result = await reserveCredits(uid, {
      jobId: creditJobId,
      credits: input.credits,
      model: input.model,
      kind: input.kind,
      resolution: input.resolution,
    });
    if (!result.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: reserveDenyMessage(result.reason), errorCode: result.reason },
          { status: reserveDenyStatus(result.reason) },
        ),
      };
    }
    return { ok: true, creditJobId, credits: input.credits };
  } catch (error) {
    if (!(error instanceof SaySellUnavailable)) throw error;
    console.error("[charge] saysell-web indisponível:", error.message);
    return {
      ok: false,
      response: NextResponse.json({ error: "Não deu para conferir seus créditos agora. Tente de novo." }, { status: 503 }),
    };
  }
}

/** Devolve a reserva quando a geração nem chegou a ser criada no provedor. */
export async function refundCharge(uid: string, creditJobId: string): Promise<void> {
  await settleCredits(uid, creditJobId, "refunded").catch((e) =>
    console.error(`[charge] estorno de ${creditJobId} falhou:`, e),
  );
}

/** Resolução no formato que a política de planos entende. */
export function imageResolution(quality: string | undefined): string {
  const q = (quality ?? "1k").toLowerCase();
  return q === "1k" || q === "2k" || q === "4k" || q === "1.5k" ? q : "1k";
}

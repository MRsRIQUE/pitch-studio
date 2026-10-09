/**
 * POST /api/generate — gera imagem.
 *
 * Ordem: sessão → modelo → custo → reserva de crédito no saysell-web →
 * createTask na kie.ai → job pendente. Se a kie.ai recusar ou a chamada cair,
 * a reserva é estornada antes de responder. O resultado chega pela leitura do
 * status (`/api/job-status`, `/api/job-stream`) e pelo Cron.
 *
 * Os ramos Azure Foundry e codex-imagegen do app local saíram: no Studio
 * hospedado a única saída paga é a kie.ai, cobrada em créditos do plano.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";
import { getKieTokenForUser } from "@/lib/getKieToken";
import { chargeGeneration, creditsFor, imageResolution, refundCharge } from "@/lib/jobs/charge";
import { startJob } from "@/lib/jobs/lifecycle";
import { ensureKieReachableImages } from "@/lib/kieUpload";
import { MOCK_TASK_PREFIX, shouldMock } from "@/lib/mockProvider";
import { IMAGE_MODELS } from "@/lib/modelConfig";
import { ensureR2 } from "@/lib/storage";

const CREATE = "https://api.kie.ai/api/v1/jobs/createTask";

export const runtime = "nodejs";
export const maxDuration = 60;

// Toda URL de referência vira uma URL nossa (Blob), alcançável pela kie.ai.
async function resolveImages(imageUrls: string[]): Promise<string[]> {
  const resolved = await Promise.all(
    imageUrls.slice(0, 14).map((u) => ensureR2(u, "references").catch(() => null)),
  );
  return resolved.filter((u): u is string => u !== null);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const {
    model = "nano-banana-2",
    prompt,
    imageUrls = [],
    aspectRatio = "1:1",
    quality = "1k",
    segmentTaskId,
    maskIndexes,
  } = (await req.json()) as {
    model?: string;
    prompt?: string;
    imageUrls?: string[];
    aspectRatio?: string;
    quality?: string;
    segmentTaskId?: string; // Grok 2.0 Segment Edit source task
    maskIndexes?: number[]; // Grok 2.0 Segment Edit selected regions
  };

  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const cfg = IMAGE_MODELS.find((m) => m.id === model);
  if (!cfg) return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });

  if (cfg.requiresSegmentTask) {
    if (!segmentTaskId?.trim()) {
      return NextResponse.json({ error: "Grok Segment Edit requires a source task ID from Grok Imagine 2.0 or Segment Map." }, { status: 400 });
    }
    if (!Array.isArray(maskIndexes) || maskIndexes.length === 0 || maskIndexes.some((n) => !Number.isInteger(n) || n < 0)) {
      return NextResponse.json({ error: "Grok Segment Edit requires at least one valid mask index." }, { status: 400 });
    }
  }

  if (cfg.oneKOnlyRatios?.includes(aspectRatio) && quality.toLowerCase() !== "1k") {
    return NextResponse.json({ error: `${aspectRatio} is only available at 1K for ${cfg.name}.` }, { status: 400 });
  }

  let r2ImageUrls: string[] = [];
  try {
    r2ImageUrls = await resolveImages(imageUrls);
  } catch {
    // falha ao espelhar referência não é fatal — segue sem ela
  }

  const store = await data();
  const kieToken = await getKieTokenForUser();

  // Sem chave kie.ai: provider simulado (lib/mockProvider.ts), sem cobrança.
  if (shouldMock(kieToken)) {
    const taskId = `${MOCK_TASK_PREFIX}${randomUUID()}`;
    await store.insertGeneration(user.uid, {
      task_id: taskId, generation_type: "image", status: "pending",
      prompt, model, aspect_ratio: aspectRatio, quality, reference_image_urls: r2ImageUrls,
    });
    await startJob({
      uid: user.uid, taskId, kind: "image", provider: "mock", model, creditJobId: null,
      mockInput: { prompt, aspectRatio, referenceImageUrls: r2ImageUrls },
    });
    return NextResponse.json({ taskId, referenceImageUrls: r2ImageUrls });
  }

  if (!kieToken) return NextResponse.json({ error: "Geração indisponível no momento." }, { status: 503 });

  const charge = await chargeGeneration(user.uid, {
    kind: "image",
    model,
    resolution: imageResolution(quality),
    credits: creditsFor({ model, kind: "image", quality, resolution: quality, references: r2ImageUrls.length }),
  });
  if (!charge.ok) return charge.response;

  try {
    const { apiInput } = cfg;

    // Modelos de modo duplo (ex.: GPT Image 2): texto puro usa outro apiId.
    const hasImages = r2ImageUrls.length > 0;
    const resolvedApiId = !hasImages && cfg.textOnlyApiId ? cfg.textOnlyApiId : cfg.apiId;

    let kieImageUrls = r2ImageUrls;
    if (hasImages) kieImageUrls = await ensureKieReachableImages(r2ImageUrls, kieToken);

    const input: Record<string, unknown> = cfg.requiresSegmentTask
      ? {
          prompt: prompt.slice(0, apiInput.promptMaxLength),
          task_id: segmentTaskId!.trim(),
          mask_indexs: [...new Set(maskIndexes!)],
        }
      : {
          prompt: prompt.slice(0, apiInput.promptMaxLength),
          [apiInput.aspectRatioKey]: aspectRatio,
        };

    if (!cfg.requiresSegmentTask) {
      if (apiInput.outputFormat) input.output_format = apiInput.outputFormat;
      if (apiInput.imageInputKey && hasImages) input[apiInput.imageInputKey] = kieImageUrls.slice(0, cfg.maxImages);
      if (apiInput.qualityKey) {
        input[apiInput.qualityKey] = apiInput.qualityMap
          ? (apiInput.qualityMap[quality] ?? quality)
          : quality === "4k" ? "4K" : quality === "2k" ? "2K" : quality === "1k" ? "1K" : quality;
      }
      if (apiInput.extra) Object.assign(input, apiInput.extra);
    }

    const res = await fetch(CREATE, {
      method: "POST",
      headers: { Authorization: `Bearer ${kieToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: resolvedApiId, input }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? "Geração indisponível no momento." : await res.text());
    const d = await res.json();
    if (d.code !== undefined && d.code !== 200) {
      // 401/402: chave ou saldo da conta kie.ai do SaySell — problema de operação,
      // não do usuário.
      if (d.code === 401 || d.code === 402) {
        console.error("[generate] kie.ai recusou a conta do servidor:", d.code, d.msg);
        throw new Error("Geração indisponível no momento.");
      }
      throw new Error(d.msg ?? `API error ${d.code}`);
    }

    const taskId: string | undefined = d.data?.taskId ?? d.data?.id ?? d.taskId ?? d.id;
    if (!taskId) throw new Error("No task ID in response");

    await store.insertGeneration(user.uid, {
      task_id: taskId, generation_type: "image", status: "pending",
      prompt, model, aspect_ratio: aspectRatio, quality, reference_image_urls: r2ImageUrls,
    });
    await startJob({ uid: user.uid, taskId, kind: "image", provider: "kie", kieApi: "jobs", model, creditJobId: charge.creditJobId });

    return NextResponse.json({ taskId, referenceImageUrls: r2ImageUrls });
  } catch (e: unknown) {
    await refundCharge(user.uid, charge.creditJobId);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

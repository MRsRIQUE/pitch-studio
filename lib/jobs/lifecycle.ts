/**
 * O ciclo de vida de um job de geração, sem processo vivo.
 *
 *   reserva de crédito → createTask no provedor → `startJob` (pendente)
 *   → cada leitura chama `advanceJob`, que consulta o provedor no máximo a
 *     cada POLL_GAP_MS → `settle` encerra UMA vez: grava o resultado, atualiza
 *     a geração e confirma ou estorna o crédito.
 *
 * Quem lê: `/api/job-status`, o SSE `/api/job-stream` e o Cron
 * `/api/cron/jobs` (que cobre quem fechou a aba). A trava de encerramento é
 * `updateJobIf(..., "pending", ...)`: dois leitores podem consultar a kie.ai
 * ao mesmo tempo, mas só um grava o desfecho e mexe no crédito.
 */
import { data, type StudioJob } from "@/lib/data";
import { inferGenerationErrorCode } from "@/lib/generationError";
import { getKieToken } from "@/lib/getKieToken";
import { mirrorToStorage, uploadBuffer } from "@/lib/media";
import { MOCK_LATENCY_MS, renderMockResult } from "@/lib/mockProvider";
import { settleCredits } from "@/lib/saysell/client";
import { pollKieOnce } from "./kie";

/** Intervalo mínimo entre consultas à kie.ai para o mesmo job. */
export const POLL_GAP_MS = 3_000;
/** Job pendente há mais que isto vira erro e o crédito volta. */
export const JOB_TIMEOUT_MS = 30 * 60 * 1000;

export type JobView =
  | { status: "pending"; type: "image" | "video" }
  | { status: "done"; imageUrl?: string; imageUrls?: string[]; videoUrl?: string }
  | { status: "error"; error: string; errorCode?: string };

/** O formato que o navegador já entende (o antigo `JobResult`). */
export function viewOf(job: StudioJob): JobView {
  if (job.status === "pending") return { status: "pending", type: job.kind };
  if (job.status === "done") {
    return job.kind === "video"
      ? { status: "done", videoUrl: job.videoUrl }
      : { status: "done", imageUrl: job.imageUrl, imageUrls: job.imageUrls };
  }
  const error = job.error ?? "Generation failed";
  return { status: "error", error, errorCode: job.errorCode ?? inferGenerationErrorCode(error) };
}

export async function startJob(input: {
  uid: string;
  taskId: string;
  kind: "image" | "video";
  provider: "kie" | "mock";
  kieApi?: "jobs" | "veo";
  model: string;
  creditJobId: string | null;
  mockInput?: StudioJob["mockInput"];
}): Promise<StudioJob> {
  const now = Date.now();
  const job: StudioJob = {
    taskId: input.taskId,
    uid: input.uid,
    kind: input.kind,
    provider: input.provider,
    kieApi: input.kieApi,
    status: "pending",
    model: input.model,
    creditJobId: input.creditJobId,
    createdAt: now,
    updatedAt: now,
    ...(input.provider === "mock" ? { mockReadyAt: now + MOCK_LATENCY_MS, mockInput: input.mockInput } : {}),
  };
  await (await data()).putJob(job);
  return job;
}

type Outcome =
  | { status: "done"; urls: string[] }
  | { status: "error"; error: string };

/**
 * Encerra o job se ainda estiver pendente. Devolve o job como ficou — o
 * encerrado por este leitor ou o que outro leitor encerrou antes.
 */
export async function settle(job: StudioJob, outcome: Outcome): Promise<StudioJob> {
  const store = await data();
  const patch =
    outcome.status === "done"
      ? job.kind === "video"
        ? { status: "done" as const, videoUrl: outcome.urls[0] }
        : { status: "done" as const, imageUrl: outcome.urls[0], imageUrls: outcome.urls }
      : { status: "error" as const, error: outcome.error, errorCode: inferGenerationErrorCode(outcome.error) };

  const won = await store.updateJobIf(job.taskId, "pending", patch);
  if (!won) return (await store.getJob(job.taskId)) ?? job;

  await store
    .updateGeneration(
      job.uid,
      job.taskId,
      outcome.status === "done"
        ? job.kind === "video"
          ? { status: "done", video_url: outcome.urls[0] }
          : { status: "done", image_url: outcome.urls[0], image_urls: outcome.urls }
        : { status: "error", error_msg: outcome.error },
    )
    .catch((e) => console.error(`[jobs] ${job.taskId}: geração não atualizada:`, e));

  if (job.creditJobId) {
    await settleCredits(job.uid, job.creditJobId, outcome.status === "done" ? "committed" : "refunded").catch((e) =>
      // O job já está encerrado; o crédito fica reservado e o Cron do
      // saysell-web/operação reconcilia. Registrar é o que dá para fazer aqui.
      console.error(`[jobs] ${job.taskId}: encerramento do crédito falhou:`, e),
    );
  }
  return { ...job, ...patch };
}

/** Avança o job um passo. Sem efeito para job encerrado ou consultado há pouco. */
export async function advanceJob(taskId: string, options: { force?: boolean } = {}): Promise<StudioJob | null> {
  const store = await data();
  const job = await store.getJob(taskId);
  if (!job || job.status !== "pending") return job;
  const now = Date.now();

  if (now - job.createdAt > JOB_TIMEOUT_MS) {
    return settle(job, { status: "error", error: "Generation timed out" });
  }

  if (job.provider === "mock") {
    if (now < (job.mockReadyAt ?? 0)) return job;
    try {
      const input = job.mockInput ?? { prompt: "", aspectRatio: "1:1" };
      const result = await renderMockResult(job.kind, { ...input, model: job.model });
      const url = await uploadBuffer(result.buffer, result.contentType, result.folder);
      return settle(job, { status: "done", urls: [url] });
    } catch (e) {
      return settle(job, { status: "error", error: `Geração simulada falhou: ${(e as Error).message}` });
    }
  }

  if (!options.force && job.lastPolledAt && now - job.lastPolledAt < POLL_GAP_MS) return job;
  const apiKey = await getKieToken();
  if (!apiKey) return settle(job, { status: "error", error: "Geração indisponível: KIE_API_KEY ausente no servidor." });

  // Marca a consulta antes de fazê-la, para leitores simultâneos não baterem
  // na kie.ai todos ao mesmo tempo. Se outro já encerrou, nada a fazer.
  if (!(await store.updateJobIf(taskId, "pending", { lastPolledAt: now }))) return store.getJob(taskId);

  const poll = await pollKieOnce(taskId, apiKey, job.kieApi ?? "jobs");
  if (poll.state === "pending" || poll.state === "transient") {
    if (poll.state === "transient") console.warn(`[jobs] ${taskId}: consulta falhou, tenta de novo:`, poll.error);
    return { ...job, lastPolledAt: now };
  }
  if (poll.state === "error") return settle(job, { status: "error", error: poll.error });

  const folder = job.kind === "video" ? "videos" : "images";
  let urls: string[];
  try {
    urls = await Promise.all(poll.urls.map((u) => mirrorToStorage(u, folder)));
  } catch (e) {
    // O link da kie.ai vale por um tempo; melhor entregar ele do que falhar.
    console.error(`[jobs] ${taskId}: espelhamento falhou, usando a URL de origem:`, (e as Error).message);
    urls = poll.urls;
  }
  return settle(job, { status: "done", urls });
}

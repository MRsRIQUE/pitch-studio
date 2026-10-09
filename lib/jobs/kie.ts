/**
 * Uma consulta à kie.ai sobre um job — sem laço. Quem repete é quem lê o
 * status (`/api/job-status`, o SSE e o Cron), via `lib/jobs/lifecycle.ts`.
 *
 * Duas APIs: a de jobs genérica (`/api/v1/jobs/recordInfo`, a mesma do antigo
 * `kieJobPoller`) e a do Veo (`/api/v1/veo/record-info`), que o app local nunca
 * consultava — por isso Veo só terminava com callback.
 */

const BASE = "https://api.kie.ai";

export type KiePoll =
  | { state: "pending" }
  | { state: "done"; urls: string[] }
  | { state: "error"; error: string }
  /** Falha de rede ou resposta estranha: tenta de novo na próxima leitura. */
  | { state: "transient"; error: string };

export async function pollKieOnce(taskId: string, apiKey: string, api: "jobs" | "veo"): Promise<KiePoll> {
  const url =
    api === "veo"
      ? `${BASE}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`
      : `${BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  let json: Record<string, unknown>;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    json = (await res.json()) as Record<string, unknown>;
    if (res.status >= 500) return { state: "transient", error: `kie.ai HTTP ${res.status}` };
  } catch (e) {
    return { state: "transient", error: (e as Error).message };
  }
  if (json.code !== undefined && json.code !== 200 && json.code !== 0) {
    return { state: "error", error: String(json.msg ?? `kie.ai error ${String(json.code)}`) };
  }
  const data = (json.data ?? json) as Record<string, unknown>;
  return api === "veo" ? readVeo(data) : readJobs(data);
}

function readJobs(data: Record<string, unknown>): KiePoll {
  const state = String(data.state ?? data.status ?? "").toLowerCase();
  if (state === "success" || state === "succeeded") {
    const urls = extractUrls(data);
    return urls.length ? { state: "done", urls } : { state: "error", error: "Generation succeeded but returned no output" };
  }
  if (state === "fail" || state === "failed" || state === "error") {
    const msg = (data.failMsg as string) ?? (data.error as string) ?? (data.failReason as string) ?? "Generation failed";
    return { state: "error", error: msg };
  }
  return { state: "pending" };
}

/** Veo: `successFlag` 0 = gerando, 1 = pronto, 2/3 = falhou. */
function readVeo(data: Record<string, unknown>): KiePoll {
  const flag = Number(data.successFlag);
  if (flag === 1) {
    const response = (data.response ?? {}) as Record<string, unknown>;
    const raw = response.resultUrls ?? data.resultUrls;
    const urls = Array.isArray(raw) ? raw.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
    return urls.length ? { state: "done", urls } : { state: "error", error: "Generation succeeded but returned no output" };
  }
  if (flag === 2 || flag === 3) {
    return { state: "error", error: String(data.errorMessage ?? data.failMsg ?? "Generation failed") };
  }
  return { state: "pending" };
}

export function extractUrls(data: Record<string, unknown>): string[] {
  const out: string[] = [];
  const resultJson = data.resultJson as string | undefined;
  if (resultJson) {
    try {
      const parsed = JSON.parse(resultJson) as { resultUrls?: unknown; resultUrl?: unknown };
      const urls = parsed.resultUrls ?? parsed.resultUrl;
      if (Array.isArray(urls)) out.push(...urls.filter((u): u is string => typeof u === "string" && Boolean(u)));
      else if (typeof urls === "string" && urls) out.push(urls);
    } catch {
      /* cai nos outros formatos */
    }
  }
  if (out.length === 0 && typeof data.videoUrl === "string") out.push(data.videoUrl);
  if (out.length === 0) {
    const output = data.output as unknown;
    if (Array.isArray(output) && output[0]) out.push(String(output[0]));
    else if (typeof output === "string") out.push(output);
  }
  return out;
}

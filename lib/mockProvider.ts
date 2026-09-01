/**
 * Provider simulado do Pitch Studio.
 *
 * Existe para o app ser navegável de ponta a ponta sem uma chave da kie.ai:
 * o ciclo real de um job (jobStore → evento SSE em `/api/job-status` → guest DB
 * → galeria) roda inteiro; só a chamada externa é falsa.
 *
 * Ativo quando `MOCK_GENERATION !== "false"` E não há chave kie.ai configurada.
 * Assim que a chave é preenchida (env `KIE_API_KEY` ou Settings → API Keys), o
 * caminho real assume sozinho e este módulo deixa de ser consultado.
 *
 * Os task IDs recebem o prefixo `mock-`, seguindo a convenção que
 * `lib/kieJobPoller.ts` já usa para providers locais (`azure-`, `codex-`), de
 * modo que nenhum poller tente buscar esses jobs na kie.ai.
 */
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { jobStore, type JobResult } from "./jobStore";
import { jobEvents } from "./jobEvents";
import { GUEST_MODE } from "./guestMode";
import * as guestDb from "./guest/db";
import { uploadBuffer } from "./guest/localStorage";

export const MOCK_TASK_PREFIX = "mock-";

/** Quanto tempo o job simulado leva para "gerar", em ms. */
const MOCK_LATENCY_MS = 2_500;

/** Vídeo simulado: asset estático em `public/mock/`, sem ffmpeg em runtime. */
const PLACEHOLDER_VIDEO = join(process.cwd(), "public", "mock", "placeholder-video.mp4");

export type MockKind = "image" | "video";

export function isMockTaskId(taskId: string): boolean {
  return taskId.startsWith(MOCK_TASK_PREFIX);
}

/**
 * Só simula quando não há chave de verdade. `MOCK_GENERATION=false` desliga o
 * fallback, fazendo a ausência de chave voltar a ser o erro 401 original.
 */
export function shouldMock(kieToken: string | null | undefined): boolean {
  if (kieToken) return false;
  return process.env.MOCK_GENERATION !== "false";
}

// ── Render do placeholder ────────────────────────────────────────────────────

const PALETTE = ["#8b7dd8", "#5aa9e6", "#e2a03f", "#59b287", "#d9636f", "#7c8ba1"];

/** Cor estável por prompt: o mesmo prompt sempre gera o mesmo placeholder. */
function tone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

/** Quebra o prompt em linhas curtas para caber no placeholder. */
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine) {
      lines.push(line.trim());
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, perLine - 1) + "…";
  }
  return lines;
}

function dimensions(aspectRatio: string): { w: number; h: number } {
  const m = aspectRatio?.match(/^(\d+):(\d+)$/);
  const [aw, ah] = m ? [Number(m[1]), Number(m[2])] : [1, 1];
  const base = 1024;
  return aw >= ah
    ? { w: base, h: Math.round((base * ah) / aw) }
    : { w: Math.round((base * aw) / ah), h: base };
}

async function renderImage(prompt: string, aspectRatio: string, model: string): Promise<Buffer> {
  const { w, h } = dimensions(aspectRatio);
  const accent = tone(prompt || model);
  const lines = wrap(prompt || "sem prompt", 34, 4);
  const startY = h / 2 - (lines.length - 1) * 19;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14161c"/>
      <stop offset="100%" stop-color="#1d2029"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.34}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.20"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.24}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.32"/>
  <text x="${w / 2}" y="${h * 0.16}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" letter-spacing="5" fill="${accent}" opacity="0.85">PITCH STUDIO · MODO SIMULADO</text>
${lines
  .map(
    (l, i) =>
      `  <text x="${w / 2}" y="${startY + i * 38}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#e6e8ee">${escapeXml(l)}</text>`,
  )
  .join("\n")}
  <text x="${w / 2}" y="${h * 0.88}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="2" fill="#6b7280">${escapeXml(model)} · ${escapeXml(aspectRatio)}</text>
  <text x="${w / 2}" y="${h * 0.94}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#4b5563">configure sua chave kie.ai em Settings para gerar de verdade</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Ciclo de vida do job simulado ────────────────────────────────────────────

export interface MockJobParams {
  kind: MockKind;
  prompt: string;
  model: string;
  aspectRatio?: string;
  userId?: string | null;
  referenceImageUrls?: string[];
  duration?: number;
}

/**
 * Cria um job simulado e devolve o taskId imediatamente, como fazem os
 * handlers reais. A resolução acontece em background depois de MOCK_LATENCY_MS.
 */
export function startMockJob(params: MockJobParams): string {
  const taskId = `${MOCK_TASK_PREFIX}${randomUUID()}`;
  const { kind, prompt, model, aspectRatio = "1:1", userId = null } = params;

  jobStore.set(taskId, { status: "pending", userId: userId ?? undefined });

  if (GUEST_MODE) {
    guestDb.insertGeneration({
      task_id:              taskId,
      user_id:              userId,
      generation_type:      kind,
      status:               "pending",
      prompt,
      model,
      aspect_ratio:         aspectRatio,
      duration:             params.duration,
      reference_image_urls: params.referenceImageUrls ?? [],
    });
  }

  void resolveLater(taskId, params);
  return taskId;
}

async function resolveLater(taskId: string, params: MockJobParams): Promise<void> {
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
  try {
    if (params.kind === "video") {
      const buf = await readFile(PLACEHOLDER_VIDEO);
      const url = await uploadBuffer(buf, "video/mp4", "videos");
      settle(taskId, "video", { status: "done", videoUrl: url });
    } else {
      const buf = await renderImage(params.prompt, params.aspectRatio ?? "1:1", params.model);
      const url = await uploadBuffer(buf, "image/png", "images");
      settle(taskId, "image", { status: "done", imageUrl: url, imageUrls: [url] });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[mock] ${taskId} falhou:`, msg);
    settle(taskId, params.kind, { status: "error", error: `Geração simulada falhou: ${msg}` });
  }
}

/**
 * Mesma sequência de `settle` em lib/kieJobPoller.ts: grava o jobStore, emite o
 * evento que o SSE de `/api/job-status` aguarda, e espelha no guest DB.
 */
function settle(taskId: string, kind: MockKind, result: JobResult): void {
  jobStore.set(taskId, result);
  jobEvents.emit(`job:${taskId}`, result);

  if (!GUEST_MODE) return;
  if (result.status === "done") {
    guestDb.updateGeneration(
      taskId,
      kind === "video"
        ? { status: "done", video_url: result.videoUrl }
        : { status: "done", image_url: result.imageUrl, image_urls: result.imageUrls },
    );
  } else if (result.status === "error") {
    guestDb.updateGeneration(taskId, { status: "error", error_msg: result.error });
  }
}

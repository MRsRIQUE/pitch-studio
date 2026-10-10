/**
 * Provider simulado do SaySell Studio.
 *
 * Existe para o app ser navegável de ponta a ponta sem uma chave da kie.ai:
 * o ciclo real de um job (reserva → job pendente → leitura do status → galeria)
 * roda inteiro; só a chamada externa é falsa.
 *
 * Fora da Vercel, ativo quando não há `KIE_API_KEY` e `MOCK_GENERATION` não é
 * "false". Na Vercel só com `MOCK_GENERATION=true` explícito.
 *
 * Os task IDs recebem o prefixo `mock-`, de modo que ninguém tente buscar
 * esses jobs na kie.ai.
 */
import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";

export const MOCK_TASK_PREFIX = "mock-";

/** Quanto tempo o job simulado leva para "gerar", em ms. */
export const MOCK_LATENCY_MS = 2_500;

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
  // Na Vercel, sem chave é erro de configuração — simular só se pedido.
  if (process.env.VERCEL) return process.env.MOCK_GENERATION === "true";
  return process.env.MOCK_GENERATION !== "false";
}

// ── Render do placeholder ────────────────────────────────────────────────────

// Paleta da marca: Lilas, Voz, Atencao, Sucesso, Critico suave, Texto fraco.
const PALETTE = ["#60A5FA", "#0BC5EA", "#FFB547", "#01B574", "#FF8A8A", "#9FB0CC"];

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
      <stop offset="0%" stop-color="#07101F"/>
      <stop offset="100%" stop-color="#0D1B32"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.34}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.20"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.24}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.32"/>
  <text x="${w / 2}" y="${h * 0.16}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" letter-spacing="5" fill="${accent}" opacity="0.85">SAYSELL STUDIO · MODO SIMULADO</text>
${lines
  .map(
    (l, i) =>
      `  <text x="${w / 2}" y="${startY + i * 38}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" fill="#C9D2EA">${escapeXml(l)}</text>`,
  )
  .join("\n")}
  <text x="${w / 2}" y="${h * 0.88}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="2" fill="#5a6795">${escapeXml(model)} · ${escapeXml(aspectRatio)}</text>
  <text x="${w / 2}" y="${h * 0.94}" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" fill="#5a6795">defina KIE_API_KEY no servidor para gerar de verdade</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Resultado do job simulado ────────────────────────────────────────────────

/**
 * O job simulado não roda em background (na Vercel não há processo vivo):
 * `lib/jobs/lifecycle.ts` cria o job com `mockReadyAt` e, na primeira leitura
 * depois desse instante, pede aqui o arquivo e encerra o job como qualquer
 * outro.
 */
export async function renderMockResult(
  kind: MockKind,
  input: { prompt: string; aspectRatio: string; model: string },
): Promise<{ buffer: Buffer; contentType: string; folder: string }> {
  if (kind === "video") {
    return { buffer: await readFile(PLACEHOLDER_VIDEO), contentType: "video/mp4", folder: "videos" };
  }
  return {
    buffer: await renderImage(input.prompt, input.aspectRatio || "1:1", input.model),
    contentType: "image/png",
    folder: "images",
  };
}

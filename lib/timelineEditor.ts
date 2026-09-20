/* ============================================================
   Editor multi-trilha (Fase 1) — tipos compartilhados entre a UI
   (TimelineEditor.tsx, cliente) e o render (productionMedia.ts, servidor).

   Fase 1 = trilhas de vídeo/imagem sobrepostas (posição/escala) + uma
   trilha de texto estilizável, sem transições e sem stickers ainda — isso
   fica para fases seguintes, combinado com o usuário antes de construir.
   Sem preview ao vivo composto: edita números/arrasta, renderiza, revê o
   resultado — igual ao Smart Edit de hoje.
   ============================================================ */

export interface TimelineClip {
  id: string;
  url: string;
  kind: "video" | "image";
  /** 0 = trilha mais ao fundo; trilhas maiores desenham por cima. */
  track: number;
  /** Onde começa na timeline compartilhada, em segundos. */
  start: number;
  /** Por quanto tempo fica visível/toca, em segundos. */
  duration: number;
  /** Ponto de corte de entrada dentro da mídia de origem, em segundos (0 para imagem). */
  sourceIn: number;
  /** Duração total da mídia de origem, em segundos — só para limitar o arraste na UI. */
  sourceDuration: number;
  muted?: boolean;
  volume?: number;
  /** Âncora normalizada (0..1) do centro do clipe no quadro de saída. */
  x: number;
  y: number;
  /** Escala normalizada (0..1) do clipe em relação ao quadro de saída. 1 = tela cheia. */
  scale: number;
  /** Como a mídia preenche a caixa quando a proporção dela não bate com a do destino.
      "cover" (padrão) amplia e corta as sobras — é o que TikTok/CapCut fazem com vídeo
      vertical de fonte 16:9. "contain" encaixa inteiro e deixa o resto transparente.
      "fill" estica e deforma (era o comportamento único até 2026-09-20). Campo existe
      como ponto de extensão para um ajuste por clipe; ainda não há UI para trocá-lo. */
  fit?: ClipFit;
}

export type ClipFit = "cover" | "contain" | "fill";

/** Enquadramento efetivo de um clipe: o padrão de quem não declarou é "cover". */
export function clipFit(clip: Pick<TimelineClip, "fit">): ClipFit {
  return clip.fit ?? "cover";
}

export interface TimelineText {
  id: string;
  start: number;
  duration: number;
  text: string;
  color: string;
  /** Tamanho da fonte em px, relativo a uma saída de 1920px de altura. */
  fontSize: number;
  position: "top" | "center" | "bottom";
  align: "left" | "center" | "right";
}

export interface Timeline {
  width: number;
  height: number;
  clips: TimelineClip[];
  texts: TimelineText[];
  bgmUrl?: string;
  bgmVolume?: number;
  narrationUrl?: string;
  narrationVolume?: number;
}

export const newTimelineClip = (over: Pick<TimelineClip, "url" | "kind" | "sourceDuration"> & Partial<TimelineClip>): TimelineClip => ({
  id: crypto.randomUUID(),
  track: 0,
  start: 0,
  duration: Math.min(5, over.sourceDuration || 5),
  sourceIn: 0,
  volume: 1,
  x: 0.5,
  y: 0.5,
  scale: 1,
  fit: "cover",
  ...over,
});

export const newTimelineText = (over: Partial<TimelineText> = {}): TimelineText => ({
  id: crypto.randomUUID(),
  start: 0,
  duration: 3,
  text: "Texto",
  color: "#ffffff",
  fontSize: 64,
  position: "bottom",
  align: "center",
  ...over,
});

export function emptyTimeline(width = 1080, height = 1920): Timeline {
  return { width, height, clips: [], texts: [] };
}

export function timelineDuration(t: Timeline): number {
  const ends = [...t.clips.map((c) => c.start + c.duration), ...t.texts.map((c) => c.start + c.duration)];
  return ends.length ? Math.max(...ends) : 0;
}

export function trackCount(t: Timeline): number {
  return t.clips.length ? Math.max(...t.clips.map((c) => c.track)) + 1 : 1;
}

/** Corta o clipe para caber dentro da mídia de origem, sem duração negativa. */
export function clampClip(clip: TimelineClip): TimelineClip {
  const sourceIn = Math.max(0, Math.min(clip.sourceIn, Math.max(0, clip.sourceDuration - 0.1)));
  const maxDuration = clip.kind === "image" ? clip.duration : Math.max(0.1, clip.sourceDuration - sourceIn);
  return { ...clip, sourceIn, duration: Math.max(0.1, Math.min(clip.duration, maxDuration)), start: Math.max(0, clip.start) };
}

/* ── Fase 2 — playhead, split e amostragem por instante ─────────────────────
   Estes helpers são puros e agnósticos de como a preview desenha o quadro
   (canvas, <video> empilhados ou outra coisa): descrevem só QUEM está no ar
   num instante e ONDE cortar. A decisão da técnica de composição não muda
   nada aqui. */

/** Menor pedaço que faz sentido manter depois de um corte, em segundos. */
export const MIN_CLIP_DURATION = 0.2;

/** Tempo dentro da mídia de origem que corresponde ao instante `at` da timeline. */
export function sourceTimeAt(clip: TimelineClip, at: number): number {
  return clip.sourceIn + (at - clip.start);
}

/** O clipe está no ar no instante `at`? Fim é exclusivo, pra não desenhar dois clipes na emenda. */
export function isLive(item: { start: number; duration: number }, at: number): boolean {
  return at >= item.start && at < item.start + item.duration;
}

/** Clipes no ar em `at`, do fundo para a frente — a ordem em que devem ser desenhados. */
export function clipsAtTime(timeline: Timeline, at: number): TimelineClip[] {
  return timeline.clips.filter((c) => isLive(c, at)).sort((a, b) => a.track - b.track);
}

/** Textos no ar em `at`. */
export function textsAtTime(timeline: Timeline, at: number): TimelineText[] {
  return timeline.texts.filter((t) => isLive(t, at));
}

/** Divide um clipe em dois no instante `at` da timeline. Devolve null se o corte
    deixaria qualquer um dos lados menor que MIN_CLIP_DURATION (inclusive quando
    `at` cai fora do clipe). O lado direito ganha id novo e avança o sourceIn —
    para imagem não há o que avançar, a origem é um quadro só. */
export function splitClip(clip: TimelineClip, at: number): [TimelineClip, TimelineClip] | null {
  const offset = at - clip.start;
  if (offset < MIN_CLIP_DURATION || clip.duration - offset < MIN_CLIP_DURATION) return null;
  return [
    { ...clip, duration: offset },
    {
      ...clip,
      id: crypto.randomUUID(),
      start: at,
      duration: clip.duration - offset,
      sourceIn: clip.kind === "image" ? clip.sourceIn : clip.sourceIn + offset,
    },
  ];
}

/** Aplica `splitClip` dentro da timeline, preservando a ordem dos clipes.
    Devolve a mesma timeline (por identidade) quando o corte não é possível. */
export function splitTimelineClip(timeline: Timeline, clipId: string, at: number): Timeline {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;
  const parts = splitClip(clip, at);
  if (!parts) return timeline;
  return { ...timeline, clips: timeline.clips.flatMap((c) => (c.id === clipId ? parts : [c])) };
}

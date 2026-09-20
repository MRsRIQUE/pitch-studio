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

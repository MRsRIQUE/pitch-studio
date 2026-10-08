import catalog from "./generation-pricing.json";

export type CostOptions = { model: string; kind?: "image" | "video"; provider?: string; quality?: string; resolution?: string; duration?: number; count?: number; sound?: boolean; references?: number };
const names: Record<string, string[]> = {
  "google-nano-banana": ["google nano banana", "google nano banana edit"],
  "nano-banana-2": ["google nano banana 2"], "nano-banana-pro": ["google nano banana pro"],
  "nano-banana-2-lite": ["nano-banana-2-lite"], "z-image": ["qwen z-image"],
  "seedream-5-lite": ["seedream 5.0 lite"], "seedream-5-pro": ["seedream 5 pro"],
  "grok-imagine-image": ["grok-imagine"],
  "grok-imagine-image-2-segment-edit": ["grok imagine image 2 0"],
  "gpt-image-2-5-flare": ["gpt image 2 5 flare"],
  "gpt-image-2-5-sunburst": ["gpt image 2 5 sunburst"],
  "gpt-image-2": ["gpt image 2"],
  veo3_lite: ["google veo 3.1"], veo3_fast: ["google veo 3.1"], veo3: ["google veo 3.1"],
  "gemini-omni-video": ["gemini-omni-video"], "kling-3.0": ["kling 3.0"],
  "kling-3.0-turbo": ["kling 3.0 turbo"], "grok-imagine": ["grok-imagine"],
  "grok-imagine-1-5-preview": ["grok-imagine-video-1-5-preview"],
  "seedance-2": ["bytedance/seedance-2"], "seedance-2-fast": ["bytedance/seedance-2 fast"],
  "seedance-2-mini": ["bytedance/seedance-2-mini"], "seedance-2-5": ["bytedance/seedance-2-5"],
  "seedance-2-5-edit": ["bytedance/seedance-2-5"], happyhorse: ["happyhorse-1.0"],
  "minimax-h3": ["minimax h3"], "kling-2.6-motion-control": ["kling 2.6 motion control"],
  "kling-3.0-motion-control": ["kling 3.0 motion control"],
};
const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
export function estimateGenerationCost(o: CostOptions) {
  const count = Math.max(1, Math.floor(o.count || 1));
  const unavailable = (label: string) => ({ label, detail: "O provedor não publica um preço fixo para esta configuração.", credits: null });
  if (o.provider === "codex") return unavailable("Usa a cota do ChatGPT");
  if (o.provider === "azure") return unavailable("Custo conforme seu contrato Azure");
  if (o.provider === "higgsfield") return unavailable("Custo conforme sua conta Higgsfield");
  const kind = o.kind ?? "image";
  const aliases = (names[o.model] ?? [o.model]).map(norm);
  let rows = catalog.rates.filter(r => r.interfaceType === kind && aliases.some(alias => norm(r.modelDescription.split(",")[0]).includes(alias) || alias.includes(norm(r.modelDescription.split(",")[0]))) && !/input image|layer decomposition|extend|get 1080|get 4k/i.test(r.modelDescription));
  const narrow = (test: (s: string) => boolean) => { const selected = rows.filter(r => test(r.modelDescription.toLowerCase())); if (selected.length) rows = selected; };
  if (o.model.startsWith("veo3")) {
    const tier = o.model === "veo3_lite" ? "lite" : o.model === "veo3_fast" ? "fast" : "quality";
    rows = rows.filter(r => r.modelDescription.toLowerCase().includes(tier));
  }
  const res = (o.resolution || o.quality || (kind === "image" ? "1k" : "720p")).toLowerCase();
  narrow(s => s.includes(res) || ((res === "1k" || res === "2k") && s.includes("1/2k")));
  if (o.sound !== undefined) narrow(s => o.sound ? /with audio|audio on/.test(s) : /without audio|audio off/.test(s));
  if (o.duration) narrow(s => new RegExp(`(?:^|[^\\d])${o.duration}\\s*s(?:ec|\\b)`).test(s));
  // Video-input billing includes the input duration, which may be unknown here.
  if (o.references === 0) narrow(s => /text.to.(?:image|video)|without video|no video/.test(s));
  if (kind === "image" && (o.references ?? 0) > 0) narrow(s => /image.to.image/.test(s));
  const totals = rows.flatMap(r => {
    const rate = Number(r.creditPrice);
    if (!Number.isFinite(rate) || rate < 0) return [];
    const unit = r.creditUnit.trim();
    if (unit === "per second" && !(o.duration && o.duration > 0)) return [];
    if (!/^(per image|per video|per vedio|per second|per generation|per request|per 2 images)$/.test(unit)) return [];
    const multiplier = unit === "per second" ? o.duration! : 1;
    // Two-image packs are billed per request, even for a single requested output.
    return [rate * multiplier * count + (o.model === "seedream-5-pro" ? Math.max(0, (o.references || 0) - 1) * 0.5 * count : 0)];
  });
  if (!totals.length) return unavailable("Estimativa indisponível");
  const min = Math.min(...totals), max = Math.max(...totals);
  const range = min === max ? n(min) : `${n(min)}–${n(max)}`;
  const dollars = min === max ? n(min * .005) : `${n(min * .005)}–${n(max * .005)}`;
  return { label: `≈ ${range} créditos`, credits: { min, max }, detail: `≈ US$ ${dollars} · ${count} ${kind === "image" ? "imagem(ns)" : "vídeo(s)"} · Estimativa Kie.ai, consultada em ${catalog.checkedAt}. Referências e opções adicionais podem alterar a cobrança.` };
}

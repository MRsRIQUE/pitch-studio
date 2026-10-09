import { AsyncLocalStorage } from "node:async_hooks";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { data } from "./data";
import { FFMPEG, FFPROBE } from "./ffmpegBin";
import { isStoredUrl, readStoredBytes } from "./media";
import { uploadBuffer } from "./storage";
import { clipFades, clipFit, type Timeline } from "./timelineEditor";

const exec = promisify(execFile);

/** Dono do processamento em curso — quem recebe os arquivos em `saveMedia`. */
const owner = new AsyncLocalStorage<string>();

/** Fonte do texto desenhado pelo ffmpeg (ver assets/fonts/LEIA-ME.txt). */
const FONT_FILE = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");

export async function mediaBytes(url: string): Promise<Buffer> {
  if (typeof url !== "string") throw new Error("Selecione uma mídia.");
  if (isStoredUrl(url)) return readStoredBytes(url);
  if (/^data:(image|audio|video)\/[\w.+-]+;base64,/.test(url)) return Buffer.from(url.split(",")[1], "base64");
  throw new Error("Importe a mídia para o acervo antes de processá-la.");
}
export async function saveMedia(bytes: Buffer, mime: string) {
  const url = await uploadBuffer(bytes, mime, "production");
  const uid = owner.getStore();
  if (uid) await (await data()).insertUpload(uid, { r2_url: url, mime_type: mime, source: "production" });
  return url;
}
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const v = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Valor fora do intervalo ${min}–${max}.`);
  return v;
};
export interface Clip { url: string; start: number; end: number; muted?: boolean; volume?: number }
export interface CaptionWord { text: string; start: number; end: number }
export interface MediaRequest { operation: string; url?: string; start?: number; end?: number; speed?: number; volume?: number; pitch?: number; effect?: string; scale?: number; fps?: number; width?: number; height?: number; left?: number; top?: number; rows?: number; columns?: number; threshold?: number; clips?: Clip[]; audioUrl?: string; narrationUrl?: string; audioVolume?: number; narrationVolume?: number; brightness?: number; saturation?: number; rotation?: number; replacementUrl?: string; maskUrl?: string; words?: CaptionWord[]; timeline?: Timeline }
async function ffmpeg(args: string[], cwd?: string) { return exec(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...args], { timeout: 1_200_000, maxBuffer: 24 * 1024 * 1024, windowsHide: true, cwd }); }
async function probe(path: string) { const { stdout } = await exec(FFPROBE, ["-v", "error", "-show_format", "-show_streams", "-of", "json", path], { windowsHide: true, timeout: 30000 }); return JSON.parse(stdout) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] }; }

/** Legenda estilo TikTok: uma linha (~4 palavras ou corte por pausa >0.6s) por "chunk",
 * com um evento ASS por palavra reescrevendo a linha inteira só para trocar a palavra em
 * destaque — é a técnica padrão de karaokê ASS, e deixa o libass cuidar de centralizar e
 * quebrar o texto. */
export function buildCaptionAss(words: CaptionWord[], width: number, height: number): string {
  const fontSize = Math.max(28, Math.round(height / 16));
  const outline = Math.max(2, Math.round(fontSize / 14));
  const marginV = Math.round(height * 0.16);
  const clean = (t: string) => t.replace(/[{}\\]/g, "").trim();
  const chunks: CaptionWord[][] = [];
  let current: CaptionWord[] = [], chars = 0;
  for (const w of words) {
    const gap = current.length ? w.start - current[current.length - 1].end : 0;
    if (current.length && (current.length >= 4 || chars + w.text.length > 24 || gap > 0.6)) { chunks.push(current); current = []; chars = 0; }
    current.push(w); chars += w.text.length + 1;
  }
  if (current.length) chunks.push(current);
  const assTime = (seconds: number) => { const s = Math.max(0, seconds); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`; };
  const events: string[] = [];
  for (const chunk of chunks) {
    for (let j = 0; j < chunk.length; j++) {
      const start = chunk[j].start, end = j < chunk.length - 1 ? chunk[j + 1].start : chunk[j].end;
      if (end <= start) continue;
      const line = chunk.map((w, k) => k === j ? `{\\c&H00FFFF&}${clean(w.text)}{\\c&HFFFFFF&}` : clean(w.text)).join(" ");
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${line}`);
    }
  }
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,${outline},0,2,40,40,${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join("\n")}\n`;
}
/** Como encaixar a mídia numa caixa w×h. "cover" (padrão) amplia preservando a proporção
    e corta as sobras — sem barra preta e sem deformar, igual ao TikTok/CapCut. "contain"
    encaixa inteiro e preenche o resto com transparência (a base por baixo aparece).
    "fill" é o esticamento que era o único comportamento até 2026-09-20. */
const fitFilter = (w: number, h: number, fit: string) =>
  fit === "fill" ? `scale=${w}:${h}`
    : fit === "contain" ? `format=yuva420p,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0`
      : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;

/** Transição por alpha, não `xfade`: o grafo é de overlays com tempos absolutos, e o
    `xfade` exigiria adjacência na mesma trilha e re-cronometraria a timeline inteira.
    Como os `setpts` já colocaram o clipe no tempo global, o `st` do fade é absoluto.
    Dois clipes sobrepostos no tempo viram um crossfade sem mais nada. */
const fadeFilters = (entrada: number, saida: number, start: number, duracao: number, audio: boolean) => {
  const partes: string[] = [];
  const f = audio ? "afade" : "fade";
  if (entrada > 0) partes.push(`${f}=t=in:st=${start}:d=${entrada}${audio ? "" : ":alpha=1"}`);
  if (saida > 0) partes.push(`${f}=t=out:st=${(start + duracao - saida).toFixed(3)}:d=${saida}${audio ? "" : ":alpha=1"}`);
  // sem alpha no formato, o `fade` escurece para preto em vez de deixar ver a camada de baixo
  return partes.length && !audio ? ["format=yuva420p", ...partes] : partes;
};

export async function processMedia(body: MediaRequest, uid: string) {
  return owner.run(uid, () => processMediaFor(body));
}

async function processMediaFor(body: MediaRequest) {
  const temp = await mkdtemp(join(tmpdir(), "pitch-production-"));
  try {
    const input = join(temp, "input");
    if (body.url) await writeFile(input, await mediaBytes(body.url));
    if (body.operation.startsWith("image-")) {
      const originalBytes = await readFile(input);
      const original = await sharp(originalBytes, { failOn: "none" }).png().toBuffer();
      const meta = await sharp(original).metadata();
      const width = meta.width!, height = meta.height!;
      let pipeline = sharp(original, { failOn: "none" }).removeAlpha();
      if (body.operation === "image-mask") {
        const replacement = await sharp(await mediaBytes(body.replacementUrl!), { failOn: "none" }).removeAlpha().resize(width, height).ensureAlpha().png().toBuffer();
        const mask = await sharp(await mediaBytes(body.maskUrl!), { failOn: "none" }).removeAlpha().resize(width, height).ensureAlpha().png().toBuffer();
        const region = await sharp(replacement, { failOn: "none" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
        return { url: await saveMedia(await sharp(original, { failOn: "none" }).removeAlpha().composite([{ input: region }]).png().toBuffer(), "image/png") };
      }
      if (body.operation === "image-cutout") {
        const { data: pixels, info } = await sharp(original, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const visited = new Uint8Array(info.width * info.height), queue: number[] = [];
        const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1].map(i => [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]);
        const threshold = number(body.threshold, 50, 1, 200);
        const enqueue = (i: number) => { if (visited[i]) return; visited[i] = 1; if (corners.some(c => Math.hypot(pixels[i * 4] - c[0], pixels[i * 4 + 1] - c[1], pixels[i * 4 + 2] - c[2]) < threshold)) queue.push(i); };
        for (let x = 0; x < info.width; x++) { enqueue(x); enqueue((info.height - 1) * info.width + x); } for (let y = 0; y < info.height; y++) { enqueue(y * info.width); enqueue(y * info.width + info.width - 1); }
        for (let head = 0; head < queue.length; head++) { const i = queue[head]; pixels[i * 4 + 3] = 0; if (i % info.width) enqueue(i - 1); if (i % info.width < info.width - 1) enqueue(i + 1); if (i >= info.width) enqueue(i - info.width); if (i < info.width * (info.height - 1)) enqueue(i + info.width); }
        return { url: await saveMedia(await sharp(pixels, { raw: info }).png().toBuffer(), "image/png") };
      }
      if (body.operation === "image-grid") {
        const rows = Math.floor(number(body.rows, 2, 1, 10)), columns = Math.floor(number(body.columns, 2, 1, 10));
        const urls: string[] = [];
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
          const left = Math.floor(x * width / columns), top = Math.floor(y * height / rows);
          urls.push(await saveMedia(await sharp(original, { failOn: "none" }).removeAlpha().extract({ left, top, width: Math.floor((x + 1) * width / columns) - left, height: Math.floor((y + 1) * height / rows) - top }).png().toBuffer(), "image/png"));
        }
        return { urls };
      }
      if (body.operation === "image-crop") pipeline = pipeline.extract({ left: Math.floor(number(body.left, 0, 0, width - 1)), top: Math.floor(number(body.top, 0, 0, height - 1)), width: Math.floor(number(body.width, width, 1, width)), height: Math.floor(number(body.height, height, 1, height)) });
      else if (body.operation === "image-upscale") { const scale = number(body.scale, 2, 1, 6); pipeline = pipeline.resize(Math.min(8192, Math.round(width * scale)), Math.min(8192, Math.round(height * scale)), { fit: "inside" }); }
      else if (body.operation === "image-lighting") pipeline = pipeline.modulate({ brightness: number(body.brightness, 1, 0.1, 3), saturation: number(body.saturation, 1, 0, 3) });
      else if (body.operation === "image-outpaint") { const w = Math.floor(number(body.width, width * 2, width, 8192)), h = Math.floor(number(body.height, height * 2, height, 8192)); pipeline = pipeline.extend({ left: Math.floor((w - width) / 2), right: Math.ceil((w - width) / 2), top: Math.floor((h - height) / 2), bottom: Math.ceil((h - height) / 2), background: { r: 255, g: 255, b: 255, alpha: 1 } }); }
      else throw new Error("Ferramenta de imagem desconhecida.");
      return { url: await saveMedia(await pipeline.png().toBuffer(), "image/png") };
    }
    if (body.operation === "compose") {
      if (!body.clips?.length || body.clips.length > 100) throw new Error("Selecione entre 1 e 100 clipes.");
      const w = Math.floor(number(body.width, 1280, 64, 3840) / 2) * 2, h = Math.floor(number(body.height, 720, 64, 2160) / 2) * 2;
      const segments: string[] = []; let total = 0;
      for (const [i, clip] of body.clips.entries()) {
        const path = join(temp, `clip-${i}`); await writeFile(path, await mediaBytes(clip.url));
        const info = await probe(path), duration = Number(info.format.duration);
        const start = number(clip.start, 0, 0, duration), end = number(clip.end, duration, start + 0.01, duration + 0.05);
        total += end - start; if (total > 1200) throw new Error("A composição pode ter até 20 minutos.");
        const hasAudio = !clip.muted && info.streams.some(s => s.codec_type === "audio");
        const output = join(temp, `part-${i}.mp4`);
        const inputs = ["-ss", String(start), "-i", path, ...(!hasAudio ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : [])];
        await ffmpeg([...inputs, "-t", String(end - start), "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0", "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`, "-af", `aresample=48000,volume=${number(clip.volume, 1, 0, 2)}`, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "2", output]);
        segments.push(`file 'part-${i}.mp4'`);
      }
      const list = join(temp, "list.txt"); await writeFile(list, segments.join("\n"));
      const joined = join(temp, "joined.mp4"); await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
      let output = joined;
      const tracks = [body.audioUrl, body.narrationUrl].filter(Boolean) as string[];
      if (tracks.length) {
        const args = ["-i", joined]; const filters = ["[0:a]volume=1[a0]"];
        for (const [i, url] of tracks.entries()) { const path = join(temp, `track-${i}`); await writeFile(path, await mediaBytes(url)); args.push(...(url === body.audioUrl ? ["-stream_loop", "-1"] : []), "-i", path); filters.push(`[${i + 1}:a]volume=${number(url === body.audioUrl ? body.audioVolume : body.narrationVolume, 1, 0, 2)}[a${i + 1}]`); }
        filters.push(`${Array.from({ length: tracks.length + 1 }, (_, i) => `[a${i}]`).join("")}amix=inputs=${tracks.length + 1}:duration=first:normalize=0[mix]`);
        output = join(temp, "mixed.mp4"); await ffmpeg([...args, "-filter_complex", filters.join(";"), "-map", "0:v:0", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-t", String(total), "-movflags", "+faststart", output]);
      }
      return { url: await saveMedia(await readFile(output), "video/mp4"), duration: total };
    }
    if (body.operation === "compose-multitrack") {
      const timeline = body.timeline;
      if (!timeline || !Array.isArray(timeline.clips) || !timeline.clips.length) throw new Error("Adicione ao menos um clipe à timeline.");
      if (timeline.clips.length > 60) throw new Error("Limite de 60 clipes por timeline.");
      const texts = Array.isArray(timeline.texts) ? timeline.texts : [];
      const width = Math.floor(number(timeline.width, 1080, 64, 3840) / 2) * 2;
      const height = Math.floor(number(timeline.height, 1920, 64, 3840) / 2) * 2;
      const total = Math.min(1200, Math.max(0.5, ...timeline.clips.map(c => number(c.start, 0, 0, 1200) + number(c.duration, 1, 0.1, 1200)), ...texts.map(t => number(t.start, 0, 0, 1200) + number(t.duration, 1, 0.1, 1200))));

      const args: string[] = ["-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:d=${total}`, "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${total}`];
      const filters: string[] = [];
      const audioLabels: string[] = ["1:a"];
      let inputIndex = 2;
      const overlays: { videoLabel: string; start: number; end: number; x: number; y: number }[] = [];

      for (const clip of [...timeline.clips].sort((a, b) => a.track - b.track)) {
        const idx = inputIndex++;
        const path = join(temp, `mt-${idx}`);
        await writeFile(path, await mediaBytes(clip.url));
        const start = number(clip.start, 0, 0, total);
        const clipDuration = number(clip.duration, 1, 0.1, total - start + 0.1);
        const scale = number(clip.scale, 1, 0.05, 1);
        const w2 = Math.max(2, Math.round(width * scale / 2) * 2), h2 = Math.max(2, Math.round(height * scale / 2) * 2);
        const x = Math.round((width - w2) * number(clip.x, 0.5, 0, 1));
        const y = Math.round((height - h2) * number(clip.y, 0.5, 0, 1));
        const vLabel = `v${idx}`;
        const encaixe = fitFilter(w2, h2, clipFit(clip));
        const { entrada, saida } = clipFades({ ...clip, duration: clipDuration });
        const fadeV = fadeFilters(entrada, saida, start, clipDuration, false);
        const cadeiaV = [encaixe, ...fadeV].join(",");
        if (clip.kind === "image") {
          args.push("-loop", "1", "-t", String(clipDuration), "-i", path);
          filters.push(`[${idx}:v]setpts=PTS-STARTPTS+${start}/TB,${cadeiaV}[${vLabel}]`);
        } else {
          args.push("-i", path);
          const clipInfo = await probe(path);
          const sourceDuration = Number(clipInfo.format.duration);
          const sourceIn = number(clip.sourceIn, 0, 0, Math.max(0, sourceDuration - 0.05));
          filters.push(`[${idx}:v]trim=start=${sourceIn}:duration=${clipDuration},setpts=PTS-STARTPTS+${start}/TB,${cadeiaV}[${vLabel}]`);
          if (!clip.muted && clipInfo.streams.some(s => s.codec_type === "audio")) {
            const aLabel = `a${idx}`;
            filters.push(`[${idx}:a]atrim=start=${sourceIn}:duration=${clipDuration},asetpts=PTS-STARTPTS+${start}/TB,volume=${number(clip.volume, 1, 0, 2)}${fadeFilters(entrada, saida, start, clipDuration, true).map(f => `,${f}`).join("")}[${aLabel}]`);
            audioLabels.push(aLabel);
          }
        }
        overlays.push({ videoLabel: vLabel, start, end: start + clipDuration, x, y });
      }

      let current = "";
      let labelSeq = 0;
      for (const o of overlays) { const next = `ov${labelSeq++}_${o.videoLabel}`; filters.push(`[${current || "0:v"}][${o.videoLabel}]overlay=${o.x}:${o.y}:enable='between(t,${o.start},${o.end})'[${next}]`); current = next; }
      if (texts.length) await writeFile(join(temp, "font.ttf"), await readFile(FONT_FILE));
      for (const [i, t] of texts.entries()) {
        const start = number(t.start, 0, 0, total), textDuration = number(t.duration, 1, 0.1, total - start + 0.1);
        const fontSize = Math.max(8, Math.round(number(t.fontSize, 64, 8, 400) * (height / 1920)));
        const y = t.position === "top" ? String(Math.round(height * 0.08)) : t.position === "bottom" ? `h-th-${Math.round(height * 0.1)}` : "(h-th)/2";
        const x = t.align === "left" ? "40" : t.align === "right" ? "w-tw-40" : "(w-tw)/2";
        const color = /^#[0-9a-fA-F]{6}$/.test(String(t.color)) ? `0x${String(t.color).slice(1)}` : "white";
        const clean = String(t.text ?? "").replace(/[\\':]/g, "").slice(0, 200).trim() || " ";
        const next = `txt${i}`;
        filters.push(`[${current}]drawtext=fontfile=font.ttf:text='${clean}':fontcolor=${color}:fontsize=${fontSize}:x=${x}:y=${y}:borderw=3:bordercolor=black@0.85:enable='between(t,${start},${start + textDuration})'[${next}]`);
        current = next;
      }

      const tracks = [timeline.bgmUrl, timeline.narrationUrl].filter(Boolean) as string[];
      for (const url of tracks) {
        const idx = inputIndex++;
        const path = join(temp, `mt-audio-${idx}`);
        await writeFile(path, await mediaBytes(url));
        const isBgm = url === timeline.bgmUrl;
        args.push(...(isBgm ? ["-stream_loop", "-1"] : []), "-i", path);
        const label = `atrack${idx}`;
        filters.push(`[${idx}:a]volume=${number(isBgm ? timeline.bgmVolume : timeline.narrationVolume, isBgm ? 0.3 : 1, 0, 2)}[${label}]`);
        audioLabels.push(label);
      }
      filters.push(`${audioLabels.map(l => `[${l}]`).join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[mixaudio]`);

      const output = join(temp, "multitrack.mp4");
      await ffmpeg([...args, "-filter_complex", filters.join(";"), "-map", `[${current}]`, "-map", "[mixaudio]", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-t", String(total), "-c:a", "aac", "-movflags", "+faststart", output], temp);
      return { url: await saveMedia(await readFile(output), "video/mp4"), duration: total };
    }
    const info = await probe(input); const duration = Number(info.format.duration);
    if (!Number.isFinite(duration) || duration > 1200) throw new Error("Use mídia de até 20 minutos.");
    if (body.operation === "probe") return { duration, streams: info.streams };
    if (body.operation === "analyze") {
      const threshold = number(body.threshold, 0.3, 0.01, 1);
      const { stderr } = await ffmpeg(["-i", input, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-vsync", "vfr", "-f", "null", "-"]);
      const times = [0, ...Array.from(stderr.matchAll(/pts_time:([\d.]+)/g), m => Number(m[1])).filter(t => t > 0.2 && t < duration - 0.2), duration];
      const unique = [...new Set(times)].sort((a, b) => a - b).slice(0, 100); if (unique.at(-1) !== duration) unique.push(duration);
      const shots = [];
      for (let i = 0; i < unique.length - 1; i++) {
        const frame = join(temp, `frame-${i}.jpg`);
        await ffmpeg(["-ss", String((unique[i] + unique[i + 1]) / 2), "-i", input, "-frames:v", "1", "-vf", "scale=640:-2", frame]);
        shots.push({ start: unique[i], duration: unique[i + 1] - unique[i], imageUrl: await saveMedia(await readFile(frame), "image/jpeg") });
      }
      let audioStats = "Sem faixa de áudio";
      if (info.streams.some(s => s.codec_type === "audio")) { const audio = await ffmpeg(["-i", input, "-vn", "-af", "volumedetect,silencedetect=n=-35dB:d=0.5", "-f", "null", "-"]); audioStats = audio.stderr.split("\n").filter(l => /mean_volume|max_volume|silence_start|silence_end/.test(l)).join("\n"); }
      return { duration, shots, audioStats };
    }
    if (body.operation === "caption") {
      const words = Array.isArray(body.words) ? body.words.filter(w => typeof w.text === "string" && w.text.trim() && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start) : [];
      if (!words.length) throw new Error("Nenhuma palavra com tempo para gerar legenda.");
      if (words.length > 4000) throw new Error("Legenda limitada a 4000 palavras por vídeo.");
      const videoStream = info.streams.find(s => s.codec_type === "video");
      await writeFile(join(temp, "captions.ass"), buildCaptionAss(words, videoStream?.width || 1080, videoStream?.height || 1920), "utf8");
      const output = join(temp, "captioned.mp4");
      await ffmpeg(["-i", input, "-vf", "subtitles=captions.ass", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", output], temp);
      return { url: await saveMedia(await readFile(output), "video/mp4") };
    }
    const isAudio = ["audio-trim", "audio-effects", "separate-audio"].includes(body.operation);
    const output = join(temp, isAudio ? "output.wav" : "output.mp4");
    const start = number(body.start, 0, 0, duration), end = number(body.end, duration, start + 0.01, duration + 0.05), speed = number(body.speed, 1, 0.5, 2);
    const args = ["-ss", String(start), "-i", input, "-t", String(end - start)];
    if (isAudio) {
      if (!info.streams.some(s => s.codec_type === "audio")) throw new Error("Esta mídia não contém áudio.");
      const pitch = number(body.pitch, 0, -12, 12), factor = 2 ** (pitch / 12);
      const filters = [`aresample=48000,asetrate=${Math.round(48000 * factor)},aresample=48000`, `atempo=${speed / factor}`, `volume=${number(body.volume, 1, 0, 3)}`];
      const effects: Record<string, string> = { echo: "aecho=0.8:0.7:60:0.35", auditorium: "aecho=0.8:0.7:80|150:0.35|0.25", telephone: "highpass=f=400,lowpass=f=3000", robotic: "afftfilt=real='hypot(re,im)':imag=0" };
      if (body.effect && effects[body.effect]) filters.push(effects[body.effect]);
      await ffmpeg([...args, "-vn", "-af", filters.join(","), "-c:a", "pcm_s16le", output]);
    } else if (["video-trim", "video-hd", "separate-video"].includes(body.operation)) {
      const scale = number(body.scale, 1, 1, 6), fps = number(body.fps, 30, 1, 90);
      const filters = [`scale='min(3840,trunc(iw*${scale}/2)*2)':-2`, `setpts=PTS/${speed}`, `fps=${fps}`];
      await ffmpeg([...args, "-vf", filters.join(","), ...(body.operation === "separate-video" ? ["-an"] : info.streams.some(s => s.codec_type === "audio") ? ["-af", `atempo=${speed}`] : []), "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
    } else throw new Error("Opération de média desconhecida.");
    return { url: await saveMedia(await readFile(output), isAudio ? "audio/wav" : "video/mp4") };
  } finally { if (resolve(temp).startsWith(resolve(tmpdir()) + sep) && temp.includes("pitch-production-")) await rm(temp, { recursive: true, force: true }); }
}

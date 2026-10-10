"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { productionRequest } from "@/lib/productionClient";
import { MIN_CLIP_DURATION, newTimelineClip, newTimelineText, splitTimelineClip, timelineDuration, trackCount, type Timeline, type TimelineClip, type TimelineText } from "@/lib/timelineEditor";
import TimelinePreview from "./TimelinePreview";
import { useTimelinePlayback } from "./useTimelinePlayback";
import "./timeline.css";
import { uploadAssetFetch } from "@/lib/media/uploadAssetFetch";

const TRACK_HEIGHT = 60;

export default function TimelineEditor({ initial, onClose, onRendered }: {
  initial: Timeline;
  onClose: () => void;
  onRendered: (url: string, duration: number) => void;
}) {
  const [timeline, setTimeline] = useState<Timeline>(initial);
  const [pxPerSec, setPxPerSec] = useState(60);
  const [selected, setSelected] = useState<{ kind: "clip" | "text"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef(false);

  const duration = Math.max(5, timelineDuration(timeline));
  const tracks = Math.max(1, trackCount(timeline));
  const { time, playing, pause, toggle, seek } = useTimelinePlayback(duration);
  const selectedClip = selected?.kind === "clip" ? timeline.clips.find((c) => c.id === selected.id) : undefined;
  const selectedText = selected?.kind === "text" ? timeline.texts.find((t) => t.id === selected.id) : undefined;
  const canSplit = !!selectedClip
    && time - selectedClip.start >= MIN_CLIP_DURATION
    && selectedClip.start + selectedClip.duration - time >= MIN_CLIP_DURATION;

  const patchClip = (id: string, patch: Partial<TimelineClip>) => setTimeline((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const patchText = (id: string, patch: Partial<TimelineText>) => setTimeline((t) => ({ ...t, texts: t.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  function splitAtPlayhead() {
    if (!selectedClip) return;
    setTimeline((t) => splitTimelineClip(t, selectedClip.id, time));
  }

  function removeSelected() {
    if (!selected) return;
    if (selected.kind === "clip") setTimeline((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selected.id) }));
    else setTimeline((t) => ({ ...t, texts: t.texts.filter((x) => x.id !== selected.id) }));
    setSelected(null);
  }

  async function addMedia(file: File, kind: "video" | "image", extra: Partial<TimelineClip> = {}) {
    setBusy(true); setError("");
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error("Limite: 200 MB.");
      const res = await uploadAssetFetch({ method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await res.json();
      if (!res.ok || !result.cdnUrl) throw new Error(result.error || "Falha no upload.");
      let sourceDuration = 5;
      if (kind === "video") {
        const probed = await productionRequest<{ duration: number }>("/api/production/media", { operation: "probe", url: result.cdnUrl });
        sourceDuration = probed.duration;
      }
      const clip = newTimelineClip({ url: result.cdnUrl, kind, sourceDuration, track: tracks, duration: Math.min(5, sourceDuration), ...extra });
      setTimeline((t) => ({ ...t, clips: [...t.clips, clip] }));
      setSelected({ kind: "clip", id: clip.id });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao adicionar mídia."); }
    finally { setBusy(false); }
  }

  function addText() {
    const t = newTimelineText({ start: 0 });
    setTimeline((tl) => ({ ...tl, texts: [...tl.texts, t] }));
    setSelected({ kind: "text", id: t.id });
  }

  async function render() {
    if (!timeline.clips.length) { setError("Adicione ao menos um clipe."); return; }
    setBusy(true); setError("");
    try {
      const result = await productionRequest<{ url: string; duration: number }>("/api/production/media", { operation: "compose-multitrack", timeline });
      onRendered(result.url, result.duration);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao renderizar."); }
    finally { setBusy(false); }
  }

  /** Arrasta o playhead pela régua. Não deseleciona (stopPropagation): mover o
      playhead é quase sempre preparação para cortar o clipe que está selecionado. */
  function scrub(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    pause(); // arrastar a régua enquanto toca briga com o relógio
    const target: HTMLDivElement = e.currentTarget, pointerId = e.pointerId;
    const rect = target.getBoundingClientRect();
    const timeAt = (clientX: number) => Math.max(0, Math.min(duration, (clientX - rect.left) / pxPerSec));
    seek(timeAt(e.clientX));
    try { target.setPointerCapture(pointerId); } catch { /* segue sem captura; os listeners no próprio elemento ainda funcionam */ }
    function onMove(ev: PointerEvent) { if (ev.pointerId === pointerId) seek(timeAt(ev.clientX)); }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      try { target.releasePointerCapture(pointerId); } catch { /* já liberado */ }
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function dragClip(e: React.PointerEvent<HTMLDivElement>, clip: TimelineClip, mode: "move" | "trim-left" | "trim-right") {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    const target: HTMLDivElement = e.currentTarget, pointerId = e.pointerId;
    try { target.setPointerCapture(pointerId); } catch { /* segue sem captura; os listeners no próprio elemento ainda funcionam */ }
    const startX = e.clientX, startY = e.clientY;
    const origin = { start: clip.start, track: clip.track, sourceIn: clip.sourceIn, duration: clip.duration };
    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const dx = (ev.clientX - startX) / pxPerSec, dy = ev.clientY - startY;
      if (mode === "move") {
        const newTrack = Math.max(0, origin.track + Math.round(dy / TRACK_HEIGHT));
        patchClip(clip.id, { start: Math.max(0, origin.start + dx), track: newTrack });
      } else if (mode === "trim-right") {
        const maxDuration = clip.kind === "image" ? 600 : Math.max(MIN_CLIP_DURATION, clip.sourceDuration - origin.sourceIn);
        patchClip(clip.id, { duration: Math.min(maxDuration, Math.max(MIN_CLIP_DURATION, origin.duration + dx)) });
      } else {
        const maxDx = origin.duration - MIN_CLIP_DURATION;
        const minDx = clip.kind === "image" ? -origin.start : Math.max(-origin.sourceIn, -origin.start);
        const clamped = Math.max(minDx, Math.min(maxDx, dx));
        patchClip(clip.id, { start: origin.start + clamped, sourceIn: Math.max(0, origin.sourceIn + clamped), duration: origin.duration - clamped });
      }
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      dragging.current = false;
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      try { target.releasePointerCapture(pointerId); } catch { /* já liberado */ }
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function dragText(e: React.PointerEvent<HTMLDivElement>, text: TimelineText) {
    e.stopPropagation();
    e.preventDefault();
    const target: HTMLDivElement = e.currentTarget, pointerId = e.pointerId;
    try { target.setPointerCapture(pointerId); } catch { /* segue sem captura; os listeners no próprio elemento ainda funcionam */ }
    const startX = e.clientX;
    const originStart = text.start;
    function onMove(ev: PointerEvent) { if (ev.pointerId === pointerId) patchText(text.id, { start: Math.max(0, originStart + (ev.clientX - startX) / pxPerSec) }); }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      try { target.releasePointerCapture(pointerId); } catch { /* já liberado */ }
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  const timelineWidth = Math.max(600, Math.ceil(duration * pxPerSec) + 200);
  const ruler = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);

  return createPortal(
    <div className="tle-overlay">
      <div className="tle-header">
        <h2>Editor completo — multi-trilha</h2>
        <button onClick={onClose} disabled={busy}>Fechar sem renderizar</button>
        <button className="tle-primary" onClick={() => void render()} disabled={busy || !timeline.clips.length}>{busy ? "Renderizando…" : "Renderizar e usar"}</button>
      </div>
      {error && <p className="tle-error" role="alert">{error}</p>}
      <div className="tle-preview">
        {timeline.clips.length
          ? <TimelinePreview
              timeline={timeline}
              time={time}
              playing={playing}
              selectedId={selected?.kind === "clip" ? selected.id : undefined}
              onSelect={(id) => setSelected({ kind: "clip", id })}
              onMove={(id, x, y) => patchClip(id, { x, y })}
            />
          : <span className="tle-empty">Adicione um vídeo ou imagem para começar.</span>}
      </div>
      <div className="tle-toolbar">
        <label className="tle-file">+ Vídeo<input type="file" accept="video/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addMedia(f, "video"); }} /></label>
        <label className="tle-file">+ Imagem<input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addMedia(f, "image"); }} /></label>
        <label className="tle-file">+ Sticker<input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addMedia(f, "image", { scale: 0.25, fit: "contain", start: 0, duration: Math.max(1, duration) }); }} /></label>
        <button onClick={addText}>+ Texto</button>
        <button className="tle-transport" onClick={toggle} disabled={!timeline.clips.length}>{playing ? "⏸ Pausar" : "▶ Tocar"}</button>
        <button onClick={splitAtPlayhead} disabled={!canSplit} title="Divide o clipe selecionado em dois no playhead">✂ Dividir no playhead</button>
        <span className="tle-duration">{duration.toFixed(1)}s · {tracks} trilha{tracks !== 1 ? "s" : ""} · {time.toFixed(2)}s</span>
        <div className="tle-zoom">
          <button onClick={() => setPxPerSec((z) => Math.max(15, z - 15))}>−</button>
          <button onClick={() => setPxPerSec((z) => Math.min(300, z + 15))}>+</button>
        </div>
      </div>
      <div className="tle-tracks" onPointerDown={() => setSelected(null)}>
        <div style={{ width: timelineWidth, position: "relative" }}>
          <div className="tle-ruler" style={{ width: timelineWidth }} onPointerDown={scrub}>
            {ruler.map((s) => <span key={s} style={{ left: s * pxPerSec }}>{s}s</span>)}
          </div>
          {Array.from({ length: tracks }, (_, track) => (
            <div key={track} className="tle-row" style={{ height: TRACK_HEIGHT }}>
              <span className="tle-row-label">Trilha {track}{track === 0 ? " · fundo" : ""}</span>
              {timeline.clips.filter((c) => c.track === track).map((clip) => (
                <div
                  key={clip.id}
                  className={`tle-clip${clip.kind === "image" ? " tle-clip-image" : ""}${selected?.id === clip.id ? " tle-selected" : ""}`}
                  style={{ left: clip.start * pxPerSec, width: Math.max(20, clip.duration * pxPerSec) }}
                  onPointerDown={(e) => { setSelected({ kind: "clip", id: clip.id }); dragClip(e, clip, "move"); }}
                >
                  <div className="tle-handle tle-handle-left" onPointerDown={(e) => dragClip(e, clip, "trim-left")} />
                  <span className="tle-clip-label">{clip.kind === "image" ? "🖼" : "🎬"} {clip.duration.toFixed(1)}s</span>
                  <div className="tle-handle tle-handle-right" onPointerDown={(e) => dragClip(e, clip, "trim-right")} />
                </div>
              ))}
            </div>
          ))}
          <div className="tle-row tle-row-text" style={{ height: TRACK_HEIGHT }}>
            <span className="tle-row-label">Texto</span>
            {timeline.texts.map((t) => (
              <div
                key={t.id}
                className={`tle-text-clip${selected?.id === t.id ? " tle-selected" : ""}`}
                style={{ left: t.start * pxPerSec, width: Math.max(20, t.duration * pxPerSec) }}
                onPointerDown={(e) => { setSelected({ kind: "text", id: t.id }); dragText(e, t); }}
              >
                <span className="tle-clip-label">🔤 {t.text || "Texto"}</span>
              </div>
            ))}
          </div>
          <div className="tle-playhead" style={{ left: time * pxPerSec }} />
        </div>
      </div>
      <div className="tle-panel">
        {selectedClip && <>
          <label>Início (s)<input type="number" min="0" step="0.1" value={selectedClip.start.toFixed(2)} onChange={(e) => patchClip(selectedClip.id, { start: Math.max(0, Number(e.target.value)) })} /></label>
          <label>Duração (s)<input type="number" min={MIN_CLIP_DURATION} step="0.1" value={selectedClip.duration.toFixed(2)} onChange={(e) => patchClip(selectedClip.id, { duration: Math.max(MIN_CLIP_DURATION, Number(e.target.value)) })} /></label>
          <label>Trilha<input type="number" min="0" step="1" value={selectedClip.track} onChange={(e) => patchClip(selectedClip.id, { track: Math.max(0, Math.round(Number(e.target.value))) })} /></label>
          <label>Posição X (0-1)<input type="number" min="0" max="1" step="0.05" value={selectedClip.x} onChange={(e) => patchClip(selectedClip.id, { x: Math.max(0, Math.min(1, Number(e.target.value))) })} /></label>
          <label>Posição Y (0-1)<input type="number" min="0" max="1" step="0.05" value={selectedClip.y} onChange={(e) => patchClip(selectedClip.id, { y: Math.max(0, Math.min(1, Number(e.target.value))) })} /></label>
          <label>Escala (0-1)<input type="number" min="0.05" max="1" step="0.05" value={selectedClip.scale} onChange={(e) => patchClip(selectedClip.id, { scale: Math.max(0.05, Math.min(1, Number(e.target.value))) })} /></label>
          <label>Fade entrada (s)<input type="number" min="0" max={selectedClip.duration} step="0.1" value={selectedClip.fadeIn ?? 0} onChange={(e) => patchClip(selectedClip.id, { fadeIn: Math.max(0, Number(e.target.value)) })} /></label>
          <label>Fade saída (s)<input type="number" min="0" max={selectedClip.duration} step="0.1" value={selectedClip.fadeOut ?? 0} onChange={(e) => patchClip(selectedClip.id, { fadeOut: Math.max(0, Number(e.target.value)) })} /></label>
          {selectedClip.kind === "video" && <label>Volume<input type="number" min="0" max="2" step="0.1" value={selectedClip.volume ?? 1} onChange={(e) => patchClip(selectedClip.id, { volume: Math.max(0, Number(e.target.value)) })} /></label>}
          {selectedClip.kind === "video" && <label><input type="checkbox" checked={!!selectedClip.muted} onChange={(e) => patchClip(selectedClip.id, { muted: e.target.checked })} /> Silenciar</label>}
          <button className="tle-danger" onClick={removeSelected}>Remover clipe</button>
        </>}
        {selectedText && <>
          <label>Texto<input type="text" value={selectedText.text} onChange={(e) => patchText(selectedText.id, { text: e.target.value })} /></label>
          <label>Início (s)<input type="number" min="0" step="0.1" value={selectedText.start.toFixed(2)} onChange={(e) => patchText(selectedText.id, { start: Math.max(0, Number(e.target.value)) })} /></label>
          <label>Duração (s)<input type="number" min={MIN_CLIP_DURATION} step="0.1" value={selectedText.duration.toFixed(2)} onChange={(e) => patchText(selectedText.id, { duration: Math.max(MIN_CLIP_DURATION, Number(e.target.value)) })} /></label>
          <label>Cor<input type="color" value={selectedText.color} onChange={(e) => patchText(selectedText.id, { color: e.target.value })} /></label>
          <label>Tamanho<input type="number" min="8" max="400" step="2" value={selectedText.fontSize} onChange={(e) => patchText(selectedText.id, { fontSize: Number(e.target.value) })} /></label>
          <label>Posição<select value={selectedText.position} onChange={(e) => patchText(selectedText.id, { position: e.target.value as TimelineText["position"] })}>{["top", "center", "bottom"].map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label>Alinhamento<select value={selectedText.align} onChange={(e) => patchText(selectedText.id, { align: e.target.value as TimelineText["align"] })}>{["left", "center", "right"].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <button className="tle-danger" onClick={removeSelected}>Remover texto</button>
        </>}
        {!selectedClip && !selectedText && <span className="tle-duration">Selecione um clipe ou texto na timeline para editar.</span>}
      </div>
    </div>,
    document.body,
  );
}

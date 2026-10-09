"use client";
import { useRef, useState, type SyntheticEvent } from "react";
import type { NodeData } from "@/lib/store";
import { useWorkflowStore } from "@/lib/store";
import { generateProductionImage, outputToCanvas, productionRequest } from "@/lib/productionClient";
import { STUDIO_PRESETS } from "@/lib/studioPresets";
import { IMAGE_MODELS } from "@/lib/modelConfig";
import { uploadAssetFetch } from "@/lib/media/uploadAssetFetch";

const TOOLS = [ ["crop", "Crop · Recortar"], ["upscale", "HD Upscale"], ["grid", "Grid Split"], ["cutout", "Cutout · Remover fundo uniforme"], ["repaint", "Repaint · Pintar área"], ["erase", "Erase · Remover área"], ["outpaint", "Outpaint · Expandir"], ["multiangle", "Multi-Angle"], ["lighting", "Lighting"], ["lighting-ai", "Lighting Smart Mode"], ["focus", "Focus Edit"], ["lens", "Lens Focus"], ["panorama", "720 Panorama"], ["preset", "Studio Tools"] ];
export default function MediaStudio({ id, data, kind }: { id: string; data: NodeData; kind: "image" | "video" | "audio" }) {
  const [tool, setTool] = useState(kind === "image" ? "crop" : "trim"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [prompt, setPrompt] = useState(""), [model, setModel] = useState("nano-banana-pro"), [preset, setPreset] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({ left: 0, top: 0, width: 512, height: 512, scale: 2, rows: 2, columns: 2, brightness: 1, saturation: 1, start: 0, speed: 1, fps: 30, threshold: 50, azimuth: 0, elevation: 0, distance: 1, brush: 40 });
  const [size, setSize] = useState({ width: 512, height: 512 }), [maskPresent, setMaskPresent] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), image = useRef<HTMLImageElement>(null), abort = useRef<AbortController | null>(null);
  const url = String(kind === "image" ? data.r2Url || data.inputImage || data.imageUrl || "" : kind === "video" ? data.videoUrl || "" : data.audioUrl || "");
  const masked = tool === "repaint" || tool === "erase";
  const numberField = (key: string, label: string, min: number, max: number, step = 1) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={values[key] ?? 0} onChange={e => setValues({ ...values, [key]: Number(e.target.value) })} /></label>;
  const handleLoadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const duration = event.currentTarget.duration;
    if (Number.isFinite(duration)) setValues(current => ({ ...current, end: duration }));
  };
  async function run() {
    if (busy) return; setBusy(true); setError(""); const controller = new AbortController(); abort.current = controller;
    try {
      if (!url) throw new Error("Este node ainda não tem mídia.");
      let result: { url?: string; urls?: string[] };
      if (kind !== "image") result = await productionRequest("/api/production/media", { operation: tool === "separate-audio" || tool === "separate-video" ? tool : `${kind}-${tool === "upscale" ? "hd" : "trim"}`, url, ...values, end: values.end || undefined }, controller.signal);
      else if (["crop", "upscale", "grid", "cutout", "lighting"].includes(tool)) result = await productionRequest("/api/production/media", { operation: `image-${tool}`, url, ...values }, controller.signal);
      else {
        let reference = url;
        if (tool === "outpaint") { const expanded = await productionRequest<{ url: string }>("/api/production/media", { operation: "image-outpaint", url, width: Math.max(size.width, values.width), height: Math.max(size.height, values.height) }, controller.signal); reference = expanded.url; }
        const instruction = tool === "preset" ? STUDIO_PRESETS[preset][1] : tool === "panorama" ? STUDIO_PRESETS[8][1] : tool === "multiangle" ? `Recrie a cena vista por uma câmera em azimute ${values.azimuth} graus, elevação ${values.elevation} graus e distância relativa ${values.distance}. Preserve a identidade e o espaço.` : tool === "outpaint" ? "Preencha as margens em branco continuando a cena, preservando a imagem central." : tool === "lighting-ai" ? `Reilumine a cena. ${prompt}` : tool === "focus" ? `Recomponha preservando os elementos indicados: ${prompt}` : tool === "lens" ? `Crie um close cinematográfico de ${prompt}, preservando a identidade.` : tool === "erase" ? "Remova o objeto indicado e reconstrua o fundo naturalmente. " + prompt : "Edite a região indicada: " + prompt;
        if (masked && !maskPresent) throw new Error("Pinte a área que deseja alterar.");
        let maskUrl: string | undefined;
        if (masked && canvas.current) { const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(b => b ? resolve(b) : reject(new Error("Falha na máscara")))); const res = await uploadAssetFetch({ method: "POST", headers: { "Content-Type": "image/png" }, body: blob, signal: controller.signal }); const uploaded = await res.json(); if (!res.ok) throw new Error(uploaded.error); maskUrl = uploaded.cdnUrl; }
        const resultUrl = await generateProductionImage(`${instruction}\n${prompt}${masked ? "\nA segunda imagem é a máscara: pixels opacos indicam a região a alterar." : ""}`, [reference, ...(maskUrl ? [maskUrl] : [])], model, controller.signal);
        result = masked ? await productionRequest("/api/production/media", { operation: "image-mask", url, replacementUrl: resultUrl, maskUrl }, controller.signal) : { url: resultUrl };
      }
      const outputKind = tool === "separate-audio" ? "audio" : tool === "separate-video" ? "video" : kind;
      if (result.urls) {
        const store = useWorkflowStore.getState(), source = store.nodes.find(n => n.id === id), groupId = crypto.randomUUID();
        store.insertProductionBatch([{ id: groupId, type: "groupNode", position: { x: (source?.position.x ?? 0) + 850, y: source?.position.y ?? 0 }, style: { width: values.columns * 240 + 40, height: values.rows * 250 + 80 }, data: { label: "Storyboard Group" } }, ...result.urls.map((u, i) => ({ id: crypto.randomUUID(), type: "imageInputNode", parentId: groupId, extent: "parent" as const, position: { x: 20 + (i % values.columns) * 240, y: 60 + Math.floor(i / values.columns) * 250 }, style: { width: 210 }, data: { label: `Quadro ${i + 1}`, r2Url: u, inputImage: u } }))], []);
      } else if (result.url) outputToCanvas(id, result.url, outputKind, `${tool} · ${data.label}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro na ferramenta"); } finally { setBusy(false); }
  }
  function paint(e: React.PointerEvent<HTMLCanvasElement>) { if (!drawing.current || !canvas.current) return; const c = canvas.current, ctx = c.getContext("2d")!; const rect = c.getBoundingClientRect(); const x = (e.clientX - rect.left) * c.width / rect.width, y = (e.clientY - rect.top) * c.height / rect.height; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(x, y, values.brush, 0, Math.PI * 2); ctx.fill(); setMaskPresent(true); }
  return <>
    <label>Ferramenta<select value={tool} onChange={e => setTool(e.target.value)}>{(kind === "image" ? TOOLS : [["trim", "Recortar / velocidade"], ...(kind === "video" ? [["upscale", "Video HD"], ["separate-audio", "Separar áudio"], ["separate-video", "Separar vídeo sem áudio"]] : [])]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {kind === "image" ? <div style={{ position: "relative", maxHeight: 350, overflow: "auto" }}><img ref={image} src={url} alt="Mídia original" style={{ display: "block", width: "100%" }} onLoad={() => { if (!image.current) return; const width = image.current.naturalWidth, height = image.current.naturalHeight; setSize({ width, height }); setValues(v => ({ ...v, width, height })); }} />{masked && <canvas ref={canvas} width={size.width} height={size.height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5, touchAction: "none", cursor: "crosshair" }} onPointerDown={e => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); paint(e); }} onPointerMove={paint} onPointerUp={() => { drawing.current = false; }} />}</div> : kind === "video" ? <video src={url} controls onLoadedMetadata={handleLoadedMetadata} /> : <audio src={url} controls onLoadedMetadata={handleLoadedMetadata} />}
    <div className="pn-grid">{kind !== "image" && <>{numberField("start", "Início (s)", 0, 1200, 0.1)}{numberField("end", "Fim (s)", 0, 1200, 0.1)}{numberField("speed", "Velocidade", 0.5, 2, 0.1)}{tool === "upscale" && numberField("fps", "FPS", 1, 90)}</>}{["crop", "outpaint"].includes(tool) && <>{numberField("width", "Largura", 1, 8192)}{numberField("height", "Altura", 1, 8192)}{tool === "crop" && <>{numberField("left", "Esquerda", 0, size.width - 1)}{numberField("top", "Topo", 0, size.height - 1)}</>}</>}{tool === "upscale" && numberField("scale", "Ampliação", 1, 6)}{tool === "grid" && <>{numberField("rows", "Linhas", 1, 10)}{numberField("columns", "Colunas", 1, 10)}</>}{tool === "lighting" && <>{numberField("brightness", "Brilho", 0.1, 3, 0.1)}{numberField("saturation", "Saturação", 0, 3, 0.1)}</>}{tool === "cutout" && numberField("threshold", "Tolerância do fundo", 1, 200)}{tool === "multiangle" && <>{numberField("azimuth", "Azimute (graus)", -180, 180, 45)}{numberField("elevation", "Elevação (graus)", -45, 90, 15)}{numberField("distance", "Distância relativa", 0.5, 3, 0.5)}</>}{masked && numberField("brush", "Raio do pincel (px)", 1, 300)}</div>
    {masked && <button onClick={() => { canvas.current?.getContext("2d")?.clearRect(0, 0, size.width, size.height); setMaskPresent(false); }}>Limpar máscara</button>}
    {tool === "preset" && <label>Studio Tools<select value={preset} onChange={e => setPreset(Number(e.target.value))}>{STUDIO_PRESETS.map(([label], i) => <option value={i} key={label}>{label}</option>)}</select></label>}
    {kind === "image" && !["crop", "upscale", "grid", "cutout", "lighting"].includes(tool) && <><label>Modelo<select value={model} onChange={e => setModel(e.target.value)}>{IMAGE_MODELS.filter(m => m.supportsImages).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Instruções<textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Descreva os detalhes desejados…" /></label></>}
    {tool === "upscale" && <p className="pn-note">Ampliação local por reamostragem. Não inventa detalhes por IA.</p>}
    <div className="pn-actions"><button disabled={busy || !url} onClick={() => void run()}>Aplicar → novo node</button>{busy && <button onClick={() => abort.current?.abort()}>Interromper espera</button>}</div>{busy && <p role="status">Processando…</p>}{error && <p role="alert" className="pn-error">{error}</p>}
  </>;
}

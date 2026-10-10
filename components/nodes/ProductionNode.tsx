"use client";

import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Music2, Clapperboard, SlidersHorizontal } from "lucide-react";
import { useWorkflowStore, type NodeData } from "@/lib/store";
import { PRODUCTION_NODES } from "@/lib/production";
import { resolveInputs } from "@/lib/executor";
import dynamic from "next/dynamic";
import AudioStudio from "./AudioStudio";
import ProductionTimeline from "./ProductionTimeline";
import ScriptStudio from "./ScriptStudio";
const DirectorConsole = dynamic(() => import("./DirectorConsole"), { ssr: false });
import "./production.css";
import { uploadAssetFetch } from "@/lib/media/uploadAssetFetch";

const DIRECTION: Record<string, string[]> = {
  Gênero: ["Drama", "Comédia", "Documentário", "Fantasia", "Ficção científica", "Suspense"],
  Ritmo: ["Contemplativo", "Lento", "Moderado", "Dinâmico"],
  Paleta: ["Cool Blue", "Warm Gold", "Cinematic Amber", "Earth Tone", "Monochrome", "Pastel Dream", "Teal & Amber", "Midnight Cyan"],
  Iluminação: ["Rembrandt", "Split lighting", "Silhouette", "Window light", "Candlelight", "Hard noon", "Rim lighting"],
  Estilo: ["Cinematográfico", "Fotográfico", "Animação 3D", "Ilustração", "Analógico"],
  Câmera: ["Sony Venice", "Arri Alexa 35", "Arri Alexa 65", "Red V-Raptor", "IMAX Film Camera"],
  Lente: ["Zeiss Ultra Prime", "Cooke S4", "Canon K-35", "Arri Signature Prime", "Helios"],
  "Distância focal": ["18 mm", "24 mm", "35 mm", "50 mm", "85 mm"],
  Abertura: ["ƒ/1.4", "ƒ/4", "ƒ/11"],
};

export default function ProductionNode({ id, data, type, selected }: NodeProps<Node<NodeData>>) {
  const nodes = useWorkflowStore(s => s.nodes);
  const edges = useWorkflowStore(s => s.edges);
  const update = useWorkflowStore(s => s.updateNodeData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = PRODUCTION_NODES.find(n => n.type === type)!;
  const direction = (data.direction as Record<string, string> | undefined) ?? {};
  const incoming = resolveInputs(id, nodes, edges);
  const sourceVideos = edges.filter(e => e.target === id && e.targetHandle === "videoRef").map(e => nodes.find(n => n.id === e.source)).filter(n => n?.data.videoUrl);
  const videoUrl = String(data.videoUrl || sourceVideos[0]?.data.videoUrl || "");
  const patch = (values: Partial<NodeData>) => update(id, values);

  async function upload(file: File | undefined, kind: "audio" | "video") {
    if (!file) return;
    if (!file.type.startsWith(kind + "/")) { setError(`Selecione um arquivo de ${kind === "audio" ? "áudio" : "vídeo"}.`); return; }
    if (file.size > 100 * 1024 * 1024) { setError("O limite por arquivo é 100 MB."); return; }
    setBusy(true); setError("");
    try {
      const res = await uploadAssetFetch({ method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await res.json();
      if (!res.ok || !result.cdnUrl) throw new Error(result.error || "Não foi possível salvar o arquivo.");
      patch({ [kind === "audio" ? "audioUrl" : "videoUrl"]: result.cdnUrl, mediaName: file.name });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no upload."); }
    finally { setBusy(false); }
  }

  return <section className={`pn-node ${selected ? "pn-selected" : ""}`}>
    <header>{type === "audioNode" ? <Music2 size={18} /> : type === "directorStudioNode" ? <SlidersHorizontal size={18} /> : <Clapperboard size={18} />}<strong>{data.label || meta.label}</strong><span>{type === "audioNode" ? "RECURSO" : "PRODUÇÃO"}</span></header>
    <Handle type="target" position={Position.Left} id="prompt" style={{ top: 70 }} title="Texto de entrada" />
    {["scriptNode", "directorStudioNode", "directorConsoleNode"].includes(type) && <Handle type="target" position={Position.Left} id="image" style={{ top: 110 }} title="Referências de imagem" />}
    {(type === "smartEditNode" || type === "smartBreakdownNode") && <Handle type="target" position={Position.Left} id="videoRef" style={{ top: 105 }} title="Vídeos de referência" />}
    <Handle type="source" position={Position.Right} id={type === "audioNode" ? "audioRefOut" : "textOut"} title={type === "audioNode" ? "Referência de áudio" : "Texto para outro node"} />
    <div className="pn-body nodrag nowheel" onKeyDown={e => e.stopPropagation()}>
      <p className="pn-description">{meta.description}</p>
      {incoming.prompt && <details><summary>Texto conectado</summary><p className="pn-connected">{incoming.prompt}</p><button onClick={() => patch({ prompt: incoming.prompt })}>Usar como texto deste node</button></details>}

      {type === "audioNode" && <AudioStudio id={id} data={data} connectedPrompt={incoming.prompt} />}

      {type === "scriptNode" && <ScriptStudio id={id} data={data} connectedPrompt={incoming.prompt} />}

      {type === "directorStudioNode" && <>
        <label>Intenção criativa<textarea value={data.prompt ?? ""} onChange={e => patch({ prompt: e.target.value })} /></label>
        <div className="pn-grid">{Object.entries(DIRECTION).map(([key, options]) => <label key={key}>{key}<select value={direction[key] ?? "Auto"} onChange={e => patch({ direction: { ...direction, [key]: e.target.value } })}>{["Auto", ...options].map(v => <option key={v}>{v}</option>)}</select></label>)}</div>
        <p className="pn-note">Conecte a saída ao texto de um gerador. As escolhas são incluídas no prompt.</p>
      </>}

      {(type === "smartEditNode" || type === "smartBreakdownNode") && <>
        <label>Enviar vídeo<input type="file" accept="video/*" disabled={busy} onChange={e => { void upload(e.target.files?.[0], "video"); e.target.value = ""; }} /></label>
        {videoUrl ? <video controls src={videoUrl} /> : <p className="pn-empty">Conecte um vídeo à entrada ou envie um arquivo.</p>}
        {sourceVideos.length > 1 && <p>{sourceVideos.length} vídeos conectados · prévia do primeiro.</p>}
        <ProductionTimeline id={id} data={data} videoUrl={videoUrl} mode={type === "smartEditNode" ? "edit" : "breakdown"} />
      </>}

      {type === "directorConsoleNode" && <DirectorConsole id={id} data={data} />}
      {busy && <p role="status">Salvando arquivo…</p>}
      {error && <p className="pn-error" role="alert">{error}</p>}
    </div>
  </section>;
}

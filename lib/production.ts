import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./store";

export const PRODUCTION_NODES = [
  { type: "audioNode", label: "Áudio", description: "Upload, reprodução e referência de áudio" },
  { type: "scriptNode", label: "Roteiro", description: "Planos editáveis e preparação em lote" },
  { type: "directorStudioNode", label: "Director Studio", description: "Narrativa, estilo e cinematografia" },
  { type: "smartEditNode", label: "Smart Edit", description: "Planejamento de montagem com vídeos conectados" },
  { type: "smartBreakdownNode", label: "Smart Breakdown", description: "Decupagem manual de vídeo por planos" },
  { type: "directorConsoleNode", label: "Director Console", description: "Planejamento de objetos, poses e câmera" },
];
export const TEXT_PRODUCTION_TYPES = new Set(PRODUCTION_NODES.filter(n => n.type !== "audioNode").map(n => n.type));

export interface Shot {
  id: string; duration: number; scene: string; size: string; lighting: string;
  dialogue: string; sfx: string; movement: string; finalPrompt: string;
}
export const newShot = (): Shot => ({ id: crypto.randomUUID(), duration: 5, scene: "", size: "Plano médio", lighting: "", dialogue: "", sfx: "", movement: "", finalPrompt: "" });
export function shotPrompt(shot: Shot) {
  return [shot.scene, shot.size, shot.lighting, shot.movement, shot.dialogue && `Diálogo: ${shot.dialogue}`, shot.sfx && `Som: ${shot.sfx}`].filter(Boolean).join(". ");
}
export function productionText(data: NodeData): string {
  const shots = data.shots as Shot[] | undefined;
  if (shots?.length) return shots.map((s, i) => `Plano ${i + 1} (${s.duration}s): ${s.finalPrompt || shotPrompt(s)}`).join("\n");
  const direction = data.direction as Record<string, string> | undefined;
  return [data.prompt, ...Object.entries(direction ?? {}).filter(([, v]) => v && v !== "Auto").map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join("\n");
}
/** Drafts only: creating a batch never submits paid generation. */
export function storyboardBatch(source: Node<NodeData>, shots: Shot[], type: "generateNode" | "videoGeneratorNode"): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const groupId = crypto.randomUUID();
  const nodes: Node<NodeData>[] = [{ id: groupId, type: "groupNode", position: { x: source.position.x + (source.measured?.width ?? 760) + 80, y: source.position.y }, style: { width: Math.min(shots.length, 3) * 360 + 60, height: Math.ceil(shots.length / 3) * 350 + 80 }, data: { label: "Roteiro · " + (type === "generateNode" ? "Storyboards" : "Vídeos") } }];
  const edges: Edge[] = [];
  nodes[0].style = { width: 880, height: shots.length * 370 + 80 };
  shots.forEach((shot, i) => {
    const promptId = crypto.randomUUID();
    const generatorId = crypto.randomUUID();
    const prompt = shot.finalPrompt || shotPrompt(shot);
    nodes.push({ id: promptId, type: "promptNode", parentId: groupId, extent: "parent", position: { x: 30, y: 60 + i * 370 }, style: { width: 420, height: 250 }, data: { label: `Texto · Plano ${i + 1}`, prompt } });
    nodes.push({ id: generatorId, type, parentId: groupId, extent: "parent", position: { x: 510, y: 60 + i * 370 }, style: { width: 320 }, data: { label: `Plano ${i + 1}`, prompt, status: "idle", aspectRatio: "16:9", ...(type === "videoGeneratorNode" ? { duration: shot.duration, videoModel: String(source.data.batchVideoModel ?? "kling-3.0") } : { model: String(source.data.batchImageModel ?? "nano-banana-pro") }), sourceScriptId: source.id, sourceShotId: shot.id } });
    edges.push({ id: crypto.randomUUID(), source: promptId, target: generatorId, targetHandle: "prompt" });
  });
  const assets = (source.data.scriptAssets as { imageUrl?: string; name?: string }[] | undefined) ?? [];
  for (const [i, asset] of assets.filter(a => a.imageUrl).slice(0, type === "generateNode" ? 8 : 1).entries()) {
    const assetId = crypto.randomUUID();
    nodes.push({ id: assetId, type: "imageInputNode", parentId: groupId, extent: "parent", position: { x: 30 + i * 220, y: shots.length * 370 + 80 }, style: { width: 180 }, data: { label: asset.name ?? "Referência", r2Url: asset.imageUrl, inputImage: asset.imageUrl } });
    for (const generator of nodes.filter(n => n.type === type)) edges.push({ id: crypto.randomUUID(), source: assetId, target: generator.id, targetHandle: type === "generateNode" ? "image" : "startFrame" });
  }
  if (assets.some(a => a.imageUrl)) nodes[0].style = { width: Math.max(880, Math.min(assets.length, 8) * 220 + 60), height: shots.length * 370 + 350 };
  return { nodes, edges };
}

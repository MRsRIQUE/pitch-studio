"use client";
import { lerTurno } from "./assistantTurno";
import { loadAzureBaseUrl, loadAzureTextDeployment, loadAzureTextModelName, getAzureDeployment } from "./azureSettings";
import { getModelProvider } from "./providers";
import { useWorkflowStore, type NodeData } from "./store";
import type { Node } from "@xyflow/react";

export async function productionRequest<T = Record<string, unknown>>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const result = await res.json(); if (!res.ok) throw new Error(result.error || "A operação falhou."); return result as T;
}
export async function productionAI(prompt: string, model = "claude-sonnet-4-6", signal?: AbortSignal, images: string[] = []) {
  const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, model, images, azureEndpoint: loadAzureBaseUrl(), azureDeployment: loadAzureTextDeployment(), azureModelName: loadAzureTextModelName() }), signal });
  if (!res.ok || !res.body) { const result = await res.json().catch(() => ({})); throw new Error(result.error || "Falha no assistente."); }
  const result = await lerTurno(res.body, () => {}); if (result.falha || !result.texto.trim()) throw new Error(result.falha || "Resposta vazia do assistente."); return result.texto;
}
export function parseProductionJSON<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as T; } catch { throw new Error("A IA não retornou JSON válido. Seus dados anteriores foram preservados; tente novamente."); }
}
export const waitProduction = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => { if (signal?.aborted) { reject(new DOMException("Cancelado", "AbortError")); return; } const stop = () => { clearTimeout(timer); reject(new DOMException("Cancelado", "AbortError")); }; const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms); signal?.addEventListener("abort", stop, { once: true }); });
export async function generateProductionImage(prompt: string, imageUrls: string[], model = "nano-banana-pro", signal?: AbortSignal, aspectRatio = "16:9") {
  const provider = getModelProvider(model);
  if (provider === "kie") { const status = await fetch("/api/settings/kie-key").then(r => r.json()); if (!status.hasToken) throw new Error("Conecte Kie.ai nas configurações para gerar mídia real."); }
  const body = { prompt, imageUrls, model, aspectRatio, quality: "2k", ...(provider === "codex" ? { codexProvider: true } : provider === "azure" ? { azureBaseUrl: loadAzureBaseUrl(), azureDeployment: getAzureDeployment(model) } : {}) };
  const job = await productionRequest<{ taskId: string }>("/api/generate", body, signal);
  for (let i = 0; i < 300; i++) { await waitProduction(3000, signal); const res = await fetch(`/api/job-status?taskId=${encodeURIComponent(job.taskId)}`, { signal }); const result = await res.json(); if (result.status === "done" && result.imageUrl) return result.imageUrl as string; if (result.status === "error") throw new Error(result.error); }
  throw new Error("A geração continua no histórico. Consulte novamente mais tarde.");
}
export function outputToCanvas(sourceId: string, url: string, kind: "image" | "video" | "audio", label: string) {
  const state = useWorkflowStore.getState(), source = state.nodes.find(n => n.id === sourceId);
  const node: Node<NodeData> = { id: crypto.randomUUID(), type: kind === "image" ? "imageInputNode" : kind === "video" ? "videoInputNode" : "audioNode", position: { x: (source?.position.x ?? 0) + (source?.measured?.width ?? 760) + 80, y: source?.position.y ?? 0 }, data: { label, ...(kind === "image" ? { inputImage: url, r2Url: url } : kind === "video" ? { videoUrl: url } : { audioUrl: url }) }, style: kind === "audio" ? { width: 420, height: 620 } : { width: 320 } };
  state.insertProductionBatch([node], []); return node.id;
}

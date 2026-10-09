"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkflowStore, type NodeData } from "@/lib/store";
import { productionRequest, waitProduction, outputToCanvas } from "@/lib/productionClient";
export default function AudioStudio({ id, data, connectedPrompt }: { id: string; data: NodeData; connectedPrompt?: string }) {
  const update = useWorkflowStore(s => s.updateNodeData);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [apiKey, setApiKey] = useState(""), [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [connection, setConnection] = useState({ elevenlabs: false, kie: false });
  const [duration, setDuration] = useState(0);
  const [cloneName, setCloneName] = useState(""), [cloneFile, setCloneFile] = useState<File | null>(null);
  const [clonedVoices, setClonedVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const abort = useRef<AbortController | null>(null), player = useRef<HTMLAudioElement>(null);
  const patch = (values: Partial<NodeData>) => update(id, values);
  const provider = String(data.audioProvider ?? "kie"), operation = String(data.audioOperation ?? "speech");
  const text = String(connectedPrompt || data.prompt || "");
  async function refresh() {
    const res = await fetch("/api/production/audio"); const status = await res.json(); setConnection(status);
    if (status.elevenlabs) { const res = await fetch("/api/production/audio?voices=1"); const result = await res.json(); setVoices(result.voices ?? []); }
    const cloned = await fetch("/api/production/audio?clonedVoices=1"); const clonedResult = await cloned.json(); setClonedVoices(clonedResult.clonedVoices ?? []);
  }
  useEffect(() => { void refresh(); return () => abort.current?.abort(); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- busca inicial de conexão/vozes ao montar
  async function act(fn: (signal: AbortSignal) => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); const controller = new AbortController(); abort.current = controller; patch({ status: "running", errorMsg: undefined });
    try { await fn(controller.signal); patch({ status: "done" }); } catch (e) { const message = e instanceof Error ? e.message : "Falha no áudio"; setError(message); patch({ status: controller.signal.aborted ? "idle" : "error", errorMsg: message }); } finally { setBusy(false); }
  }
  async function generate(signal: AbortSignal) {
    const result = await productionRequest<{ url?: string; taskId?: string }>("/api/production/audio", { operation, provider, text, url: data.audioUrl, voice: data.voice || (provider === "kie" ? "Rachel" : "JBFqnCBsd6RMkjVDRZzb"), model: data.audioModel, speed: data.speechSpeed ?? 1, stability: data.stability ?? 0.5, similarity: data.similarity ?? 0.75, style: data.intonation ?? 0, duration: data.audioDuration ?? 30, instrumental: data.instrumental }, signal);
    if (result.url) { patch({ audioUrl: result.url, audioTaskId: undefined }); return; }
    if (!result.taskId) throw new Error("O provedor não retornou uma tarefa.");
    patch({ audioTaskId: result.taskId }); await poll(result.taskId, signal);
  }
  async function poll(taskId: string, signal: AbortSignal) { for (let i = 0; i < 150; i++) { await waitProduction(4000, signal); const res = await fetch(`/api/production/audio?taskId=${encodeURIComponent(taskId)}`, { signal }); const result = await res.json(); if (!res.ok) throw new Error(result.error); if (result.url) { patch({ audioUrl: result.url, audioTaskId: undefined }); return; } } throw new Error("A tarefa continua no provedor. Use Consultar geração para recuperar o resultado."); }
  const runRef = useRef(generate); runRef.current = generate;
  useEffect(() => { if (data.pendingGenerate && !busy) { patch({ pendingGenerate: false }); void act(signal => runRef.current(signal)); } }, [data.pendingGenerate]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <details><summary>Conexões · Kie.ai {connection.kie ? "conectada" : "não configurada"} · ElevenLabs {connection.elevenlabs ? "conectada" : "não configurada"}</summary><label>Chave ElevenLabs<input type="password" value={apiKey} autoComplete="new-password" onChange={e => setApiKey(e.target.value)} /></label><button disabled={!apiKey || busy} onClick={() => void act(async () => { await productionRequest("/api/production/audio", { operation: "settings", apiKey }); setApiKey(""); await refresh(); })}>Salvar conexão ElevenLabs</button></details>
    <details><summary>Clonar voz · ElevenLabs{clonedVoices.length ? ` (${clonedVoices.length})` : ""}</summary>
      <label>Nome da voz<input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="Ex.: Voz do vídeo original" /></label>
      <label>Amostra de áudio<input type="file" accept="audio/*,video/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) setCloneFile(file); }} /></label>
      {cloneFile && <p className="pn-note">{cloneFile.name}</p>}
      <button disabled={busy || !cloneFile || !connection.elevenlabs} onClick={() => void act(async signal => {
        const file = cloneFile!;
        if (file.size > 100 * 1024 * 1024) throw new Error("Limite: 100 MB.");
        const up = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": file.type }, body: file, signal });
        const upResult = await up.json(); if (!up.ok || !upResult.cdnUrl) throw new Error(upResult.error || "Falha no upload da amostra.");
        await productionRequest("/api/production/audio", { operation: "clone-voice", url: upResult.cdnUrl, name: cloneName || undefined }, signal);
        setCloneFile(null); setCloneName("");
        await refresh();
      })}>Clonar voz</button>
      {!connection.elevenlabs && <p className="pn-note">Conecte sua chave ElevenLabs acima para clonar.</p>}
      {clonedVoices.length > 0 && <ul>{clonedVoices.map(v => <li key={v.voice_id}>{v.name} <button disabled={busy} onClick={() => void act(async signal => { await productionRequest("/api/production/audio", { operation: "delete-voice", voiceId: v.voice_id }, signal); await refresh(); })}>Remover</button></li>)}</ul>}
    </details>
    <div className="pn-grid"><label>Gerar<select value={operation} onChange={e => patch({ audioOperation: e.target.value, ...(e.target.value === "music" || e.target.value === "sfx" ? { audioProvider: "elevenlabs" } : {}) })}><option value="speech">Voz / narração</option><option value="music">Música</option><option value="sfx">Efeito sonoro</option><option value="isolate">Isolar voz</option></select></label><label>Provedor<select value={provider} onChange={e => patch({ audioProvider: e.target.value, voice: "" })}>{["speech", "isolate"].includes(operation) && <option value="kie">Kie.ai · ElevenLabs</option>}<option value="elevenlabs">ElevenLabs direto</option></select></label></div>
    {operation === "speech" && <><div className="pn-grid"><label>Modelo<select value={String(data.audioModel ?? "multilingual")} onChange={e => patch({ audioModel: e.target.value })}><option value="multilingual">Multilingual v2</option>{provider === "kie" ? <option value="turbo">Turbo 2.5</option> : <option value="v3">Eleven v3</option>}</select></label><label>Voz{provider === "elevenlabs" && voices.length ? <select value={String(data.voice || "JBFqnCBsd6RMkjVDRZzb")} onChange={e => patch({ voice: e.target.value })}>{voices.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select> : <input value={String(data.voice ?? "Rachel")} onChange={e => patch({ voice: e.target.value })} placeholder="Nome ou ID da voz" />}</label></div>
    <div className="pn-grid">{[{ key: "speechSpeed", label: "Velocidade da fala", value: 1, min: 0.7, max: 1.2 }, { key: "stability", label: "Estabilidade", value: 0.5, min: 0, max: 1 }, { key: "similarity", label: "Timbre / similaridade", value: 0.75, min: 0, max: 1 }, { key: "intonation", label: "Entonação / estilo", value: 0, min: 0, max: 1 }].map(p => <label key={p.key}>{p.label}<input type="number" step="0.05" min={p.min} max={p.max} value={Number(data[p.key] ?? p.value)} onChange={e => patch({ [p.key]: Number(e.target.value) })} /></label>)}</div></>}
    {operation !== "isolate" && <><label>Texto e instruções<textarea maxLength={50000} value={String(data.prompt ?? "")} onChange={e => patch({ prompt: e.target.value })} placeholder={connectedPrompt ? "Usando texto conectado" : "O que você quer ouvir?"} /></label><span>{text.length}/50000</span>{operation === "speech" && <div className="pn-actions"><button onClick={() => patch({ prompt: `${data.prompt ?? ""} … ` })}>Inserir pausa</button><button onClick={() => patch({ prompt: `${data.prompt ?? ""} hum, ` })}>Inserir hesitação</button></div>}</>}
    {["music", "sfx"].includes(operation) && <label>Duração (segundos)<input type="number" min="1" max={operation === "music" ? 600 : 30} value={Number(data.audioDuration ?? 30)} onChange={e => patch({ audioDuration: Number(e.target.value) })} /></label>}
    {operation === "music" && <label><input type="checkbox" checked={Boolean(data.instrumental)} onChange={e => patch({ instrumental: e.target.checked })} /> Somente instrumental</label>}
    <div className="pn-actions"><button disabled={busy || (operation === "isolate" ? !data.audioUrl : !text.trim())} onClick={() => void act(generate)}>{operation === "isolate" ? "Isolar voz" : "Gerar áudio"}</button>{busy && <button onClick={() => abort.current?.abort()}>Interromper espera</button>}{typeof data.audioTaskId === "string" && <button disabled={busy} onClick={() => void act(signal => poll(String(data.audioTaskId), signal))}>Consultar geração</button>}</div>
    <label>Enviar áudio<input type="file" accept="audio/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void act(async signal => { if (file.size > 100 * 1024 * 1024) throw new Error("Limite: 100 MB."); const res = await fetch("/api/upload-asset", { method: "POST", headers: { "Content-Type": file.type }, body: file, signal }); const result = await res.json(); if (!res.ok || !result.cdnUrl) throw new Error(result.error || "Falha no upload."); patch({ audioUrl: result.cdnUrl }); }); }} /></label>
    {typeof data.audioUrl === "string" && <><audio ref={player} controls src={data.audioUrl} onLoadedMetadata={() => setDuration(player.current?.duration ?? 0)} /><div className="pn-grid"><label>Início (s)<input type="number" min="0" max={duration} value={Number(data.audioStart ?? 0)} onChange={e => patch({ audioStart: Number(e.target.value) })} /></label><label>Fim (s)<input type="number" min="0" max={duration} value={Number(data.audioEnd ?? duration)} onChange={e => patch({ audioEnd: Number(e.target.value) })} /></label><label>Velocidade<input type="number" min="0.5" max="2" step="0.1" value={Number(data.audioSpeed ?? 1)} onChange={e => patch({ audioSpeed: Number(e.target.value) })} /></label><label>Volume<input type="number" min="0" max="3" step="0.1" value={Number(data.audioVolume ?? 1)} onChange={e => patch({ audioVolume: Number(e.target.value) })} /></label><label>Pitch (semitons)<input type="number" min="-12" max="12" value={Number(data.pitch ?? 0)} onChange={e => patch({ pitch: Number(e.target.value) })} /></label><label>Efeito<select value={String(data.audioEffect ?? "none")} onChange={e => patch({ audioEffect: e.target.value })}>{["none", "echo", "auditorium", "telephone", "robotic"].map(v => <option key={v}>{v}</option>)}</select></label></div><button disabled={busy} onClick={() => void act(async signal => { const result = await productionRequest<{ url: string }>("/api/production/media", { operation: "audio-effects", url: data.audioUrl, start: data.audioStart ?? 0, end: data.audioEnd ?? duration, speed: data.audioSpeed ?? 1, volume: data.audioVolume ?? 1, pitch: data.pitch ?? 0, effect: data.audioEffect }, signal); outputToCanvas(id, result.url, "audio", "Áudio editado"); })}>Aplicar recorte e efeitos em novo node</button></>}
    {busy && <p role="status">Processando áudio…</p>}{error && <p role="alert" className="pn-error">{error}</p>}
  </>;
}

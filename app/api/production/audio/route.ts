import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, insertClonedVoice, getClonedVoices, deleteClonedVoice } from "@/lib/guest/db";
import { getKieToken } from "@/lib/getKieToken";
import { mediaBytes, saveMedia } from "@/lib/productionMedia";
import { rewriteLocalMediaForKie } from "@/lib/kieUpload";
import { GUEST_USER_ID } from "@/lib/guestMode";
export const runtime = "nodejs";
export const maxDuration = 600;
const key = () => getSetting("elevenlabs_api_key") || process.env.ELEVENLABS_API_KEY;
const clamp = (v: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : fallback));
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.has("taskId")) {
      const token = await getKieToken(); if (!token) throw new Error("Conecte Kie.ai nas configurações.");
      const id = req.nextUrl.searchParams.get("taskId")!;
      const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      const result = await res.json(); if (!res.ok || !result.data) throw new Error(result.msg || "Falha ao consultar áudio.");
      if (result.data.state === "fail") throw new Error(result.data.failMsg || "A geração falhou.");
      if (result.data.state !== "success") return NextResponse.json({ status: "pending" });
      const url = JSON.parse(result.data.resultJson).resultUrls?.[0]; if (!url) throw new Error("Resposta sem áudio.");
      const media = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!media.ok) throw new Error("Falha ao baixar áudio.");
      return NextResponse.json({ status: "done", url: await saveMedia(Buffer.from(await media.arrayBuffer()), media.headers.get("content-type") || "audio/mpeg") });
    }
    if (req.nextUrl.searchParams.has("voices") && key()) {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key()! }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("Não foi possível carregar as vozes da ElevenLabs.");
      const result = await res.json(); return NextResponse.json({ voices: result.voices.map((v: { voice_id: string; name: string }) => ({ id: v.voice_id, name: v.name })) });
    }
    if (req.nextUrl.searchParams.has("clonedVoices")) return NextResponse.json({ clonedVoices: getClonedVoices(GUEST_USER_ID) });
    return NextResponse.json({ elevenlabs: !!key(), kie: !!(await getKieToken()) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Erro de áudio" }, { status: 400 }); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.operation === "settings") { if (typeof body.apiKey !== "string") throw new Error("Chave inválida."); setSetting("elevenlabs_api_key", body.apiKey.trim()); return NextResponse.json({ ok: true }); }
    const operation = body.operation as string;
    const noTextOperations = ["isolate", "transcribe", "clone-voice", "delete-voice"];
    if (!["speech", "music", "sfx", ...noTextOperations].includes(operation)) throw new Error("Operação de áudio inválida.");
    if (!noTextOperations.includes(operation) && (!body.text?.trim() || body.text.length > 50000)) throw new Error("Escreva o texto de geração (até 50.000 caracteres).");
    if (body.provider === "kie") {
      if (!["speech", "isolate"].includes(operation)) throw new Error("Este recurso usa a conexão direta ElevenLabs.");
      const token = await getKieToken(); if (!token) throw new Error("Conecte Kie.ai nas configurações.");
      const input = operation === "isolate" ? { audio_url: body.url } : { text: body.text, voice: body.voice || "Rachel", stability: clamp(body.stability, 0.5, 0, 1), similarity_boost: clamp(body.similarity, 0.75, 0, 1), style: clamp(body.style, 0, 0, 1), speed: clamp(body.speed, 1, 0.7, 1.2), language_code: "pt" };
      await rewriteLocalMediaForKie(input, token);
      const model = operation === "isolate" ? "elevenlabs/audio-isolation" : body.model === "turbo" ? "elevenlabs/text-to-speech-turbo-2-5" : "elevenlabs/text-to-speech-multilingual-v2";
      const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input }), signal: AbortSignal.timeout(60000) });
      const result = await res.json(); if (!res.ok || !result.data?.taskId) throw new Error(result.msg || "Falha ao iniciar áudio.");
      return NextResponse.json({ taskId: result.data.taskId });
    }
    if (!key()) throw new Error("Conecte sua chave ElevenLabs no painel de áudio.");
    if (operation === "clone-voice") {
      if (!body.url) throw new Error("Envie ou selecione uma amostra de áudio da voz.");
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "Voz clonada";
      const form = new FormData();
      form.append("name", name);
      const ext = /\.(\w+)(?:$|\?)/.exec(body.url)?.[1] || "mp3";
      form.append("files", new Blob([new Uint8Array(await mediaBytes(body.url))]), `sample.${ext}`);
      const res = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key()! }, body: form, signal: AbortSignal.timeout(120000) });
      if (!res.ok) { const problem = await res.json().catch(() => ({})); throw new Error(problem.detail?.message || `ElevenLabs retornou ${res.status} ao clonar a voz.`); }
      const result = await res.json() as { voice_id?: string };
      if (!result.voice_id) throw new Error("ElevenLabs não retornou o id da voz clonada.");
      insertClonedVoice({ user_id: GUEST_USER_ID, voice_id: result.voice_id, name, source_url: body.url });
      return NextResponse.json({ voiceId: result.voice_id, name });
    }
    if (operation === "delete-voice") {
      if (typeof body.voiceId !== "string" || !body.voiceId) throw new Error("Selecione a voz a remover.");
      const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(body.voiceId)}`, { method: "DELETE", headers: { "xi-api-key": key()! }, signal: AbortSignal.timeout(30000) });
      if (!res.ok && res.status !== 404) { const problem = await res.json().catch(() => ({})); throw new Error(problem.detail?.message || `ElevenLabs retornou ${res.status} ao remover a voz.`); }
      deleteClonedVoice(body.voiceId, GUEST_USER_ID);
      return NextResponse.json({ ok: true });
    }
    if (operation === "transcribe") {
      if (!body.url) throw new Error("Selecione o vídeo ou áudio para transcrever.");
      const form = new FormData();
      form.append("model_id", "scribe_v2");
      form.append("timestamps_granularity", "word");
      if (typeof body.language === "string" && body.language.trim()) form.append("language_code", body.language.trim());
      const ext = /\.(\w+)(?:$|\?)/.exec(body.url)?.[1] || "mp4";
      form.append("file", new Blob([new Uint8Array(await mediaBytes(body.url))]), `media.${ext}`);
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key()! }, body: form, signal: AbortSignal.timeout(570000) });
      if (!res.ok) { const problem = await res.json().catch(() => ({})); throw new Error(problem.detail?.message || `ElevenLabs retornou ${res.status} na transcrição.`); }
      const result = await res.json() as { text?: string; words?: { text: string; start: number; end: number; type?: string }[]; language_code?: string };
      const words = (result.words ?? []).filter(w => w.type !== "spacing").map(w => ({ text: w.text, start: w.start, end: w.end }));
      return NextResponse.json({ text: result.text ?? "", words, languageCode: result.language_code });
    }
    let endpoint = "", payload: BodyInit, headers: Record<string, string> = { "xi-api-key": key()!, "Content-Type": "application/json" };
    if (operation === "isolate") { endpoint = "audio-isolation"; const form = new FormData(); form.append("audio", new Blob([new Uint8Array(await mediaBytes(body.url))]), "audio.wav"); payload = form; headers = { "xi-api-key": key()! }; }
    else if (operation === "speech") { endpoint = `text-to-speech/${encodeURIComponent(body.voice || "JBFqnCBsd6RMkjVDRZzb")}`; payload = JSON.stringify({ text: body.text, model_id: body.model === "v3" ? "eleven_v3" : "eleven_multilingual_v2", voice_settings: { stability: clamp(body.stability, 0.5, 0, 1), similarity_boost: clamp(body.similarity, 0.75, 0, 1), style: clamp(body.style, 0, 0, 1), speed: clamp(body.speed, 1, 0.7, 1.2) } }); }
    else if (operation === "music") { endpoint = "music"; payload = JSON.stringify({ prompt: body.text, music_length_ms: clamp(body.duration, 30, 3, 600) * 1000, force_instrumental: body.instrumental === true, model_id: "music_v1" }); }
    else { endpoint = "sound-generation"; payload = JSON.stringify({ text: body.text, duration_seconds: clamp(body.duration, 5, 0.5, 30), prompt_influence: 0.5, model_id: "eleven_text_to_sound_v2" }); }
    const res = await fetch(`https://api.elevenlabs.io/v1/${endpoint}`, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(570000) });
    if (!res.ok) { const problem = await res.json().catch(() => ({})); throw new Error(problem.detail?.message || `ElevenLabs retornou ${res.status}. Verifique conexão, plano e parâmetros.`); }
    return NextResponse.json({ url: await saveMedia(Buffer.from(await res.arrayBuffer()), res.headers.get("content-type") || "audio/mpeg") });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na geração de áudio." }, { status: 400 }); }
}

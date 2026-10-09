import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { codexBinary, codexChatStatus } from "./codexProcess";
import { FERRAMENTAS, FERRAMENTAS_CHAT, type Ferramenta } from "./assistantTools";

// The CLI produces decisions; the existing client validates and executes them.
// No application data, credentials, or shell commands are passed as CLI arguments.
export const CODEX_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["text", "calls"],
  properties: {
    text: { type: "string" },
    calls: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["name", "arguments"],
      properties: { name: { type: "string" }, arguments: { type: "string", description: "JSON object encoded as a string, matching the selected tool schema." } },
    } },
  },
};

export function parseCodexReply(raw: string, tools: Ferramenta[]) {
  const reply = JSON.parse(raw);
  if (typeof reply?.text !== "string" || !Array.isArray(reply.calls) || reply.calls.length > 16) throw new Error("O Codex retornou uma resposta inválida.");
  const calls = reply.calls.map((call: { name: string; arguments: string }, index: number) => {
    if (!call || !tools.some(t => t.nome === call.name) || typeof call.arguments !== "string") throw new Error("O Codex solicitou uma ferramenta não disponível.");
    const args = JSON.parse(call.arguments);
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("O Codex retornou argumentos inválidos.");
    return { index, id: `codex-${randomUUID()}`, type: "function", function: { name: call.name, arguments: JSON.stringify(args) } };
  });
  return { content: reply.text, ...(calls.length ? { tool_calls: calls } : {}) };
}

/** Uma imagem que vai junto do prompt inicial, já reduzida pela rota. */
export type ImagemCodex = { url: string; jpeg: Buffer };

export async function codexChatResponse(messages: unknown[], mode: boolean | "chat" | undefined, signal: AbortSignal, imagens: ImagemCodex[] = []): Promise<Response> {
  const status = await codexChatStatus();
  if (!status.ready) return Response.json({ error: status.error || "Conecte sua conta ChatGPT no painel Codex do chat." }, { status: status.installed ? 401 : 503 });
  const tools = mode === "chat" ? FERRAMENTAS_CHAT : mode === true ? FERRAMENTAS : [];
  const environment = { ...process.env };
  // An API key in Next's environment must not override the displayed CLI login.
  delete environment.CODEX_API_KEY;
  delete environment.OPENAI_API_KEY;
  const directory = await mkdtemp(join(tmpdir(), "pitch-codex-chat-"));
  const schemaPath = join(directory, "response.schema.json");
  await writeFile(schemaPath, JSON.stringify(CODEX_RESPONSE_SCHEMA));
  /* As imagens vão pelo `--image` do `exec`, que só existe no prompt
     inicial — e o prompt aqui é um só, com o histórico inteiro. Cada
     arquivo fica no diretório efêmero da chamada; a URL original sai do
     histórico e entra uma referência ao anexo N, para o modelo casar a
     imagem que vê com a mensagem que a trouxe. */
  const arquivos: string[] = [];
  const posicaoDaUrl = new Map<string, number>();
  for (const img of imagens) {
    if (posicaoDaUrl.has(img.url)) continue;
    const caminho = join(directory, `anexo-${arquivos.length + 1}.jpg`);
    await writeFile(caminho, img.jpeg);
    posicaoDaUrl.set(img.url, arquivos.length + 1);
    arquivos.push(caminho);
  }
  const historico = messages.map(m => {
    const msg = m as { images?: string[] } & Record<string, unknown>;
    if (!Array.isArray(msg.images) || msg.images.length === 0) return m;
    const { images, ...resto } = msg;
    const numeros = images.map(u => posicaoDaUrl.get(u)).filter((n): n is number => !!n);
    return { ...resto, imagens_anexadas: numeros.map(n => `imagem anexada ${n}`) };
  });
  const prompt = [
    "Você é o motor de conversa do Pitch Studio, não um agente de programação. Não inspecione arquivos nem use ferramentas do computador.",
    "Continue o histórico JSON abaixo seguindo a mensagem system. Retorne somente o objeto do schema.",
    "text é a resposta ao usuário; calls são ações solicitadas ao aplicativo. arguments é uma string JSON com os argumentos da ferramenta.",
    "O aplicativo executará as ações e enviará os resultados no próximo turno. Não afirme que executou uma ação antes de receber seu resultado.",
    "Se não há ações a solicitar, calls deve ser []. Não repita ações já concluídas no histórico.",
    ...(arquivos.length ? [`As ${arquivos.length} imagem(ns) anexadas a este prompt são, na ordem, "imagem anexada 1" … "imagem anexada ${arquivos.length}"; cada mensagem do histórico diz em imagens_anexadas quais são dela. Olhe cada uma antes de responder.`] : []),
    `Ferramentas disponíveis: ${JSON.stringify(tools)}`,
    `Histórico da conversa: ${JSON.stringify(historico)}`,
  ].join("\n\n");
  const args = ["exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--json", "--color", "never", "--output-schema", schemaPath,
    ...arquivos.flatMap(caminho => ["--image", caminho]),
    "-c", "approval_policy=\"never\"", "-c", "web_search=\"disabled\"",
    ...["shell_tool", "apps", "plugins", "hooks", "multi_agent", "browser_use", "computer_use", "image_generation", "view_image"].flatMap(feature => ["--disable", feature]),
    ...(process.env.PITCH_CODEX_MODEL ? ["--model", process.env.PITCH_CODEX_MODEL] : []), "-"];
  let stop: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let buffer = "";
      let answer = "";
      let failure = "";
      let diagnostic = "";
      const child = spawn(/* turbopackIgnore: true */ codexBinary(), args, { cwd: directory, env: environment, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const emit = (event: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { /* The consumer disconnected. */ }
      };
      const cleanup = () => {
        clearInterval(heartbeat); clearTimeout(timeout); signal.removeEventListener("abort", abort);
        void rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
      };
      const finish = (error?: string) => {
        if (closed) return;
        if (error) emit({ type: "error", error: { message: error } });
        closed = true;
        try { controller.close(); } catch { /* The response consumer may have cancelled already. */ }
        child.kill();
        cleanup();
      };
      const abort = () => finish("Resposta do Codex interrompida.");
      stop = () => {
        if (closed) return;
        closed = true;
        child.kill();
        cleanup();
      };
      const heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(": aguardando Codex\n\n")); }, 10000);
      const timeout = setTimeout(() => finish("O Codex excedeu o tempo de resposta. Tente novamente com um pedido menor."), 180000);
      signal.addEventListener("abort", abort, { once: true });
      const line = (raw: string) => {
        if (!raw.trim()) return;
        try {
          const event = JSON.parse(raw);
          if (event.type === "item.completed" && event.item?.type === "agent_message") answer = event.item.text;
          if (event.type === "turn.failed") failure = event.error?.message || "O Codex não concluiu a resposta.";
          if (event.type === "error") diagnostic = event.message || "Falha no Codex.";
        } catch { /* Ignore non-JSON diagnostics; never forward CLI output directly. */ }
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        if (buffer.length > 2_000_000) { finish("Resposta do Codex muito grande."); return; }
        const lines = buffer.split("\n"); buffer = lines.pop() || ""; lines.forEach(line);
      });
      child.stderr.on("data", () => { /* Diagnostics may contain local paths; don't expose them. */ });
      child.stdin.on("error", () => finish("Não foi possível enviar a mensagem ao Codex."));
      child.on("error", () => finish("Não foi possível iniciar o Codex CLI. Verifique a instalação."));
      child.on("close", code => {
        if (closed) return;
        line(buffer);
        if (code !== 0 || failure || !answer) { finish(failure || diagnostic || "O Codex não respondeu. Verifique o login e os limites da conta."); return; }
        try {
          emit({ choices: [{ delta: parseCodexReply(answer, tools) }] });
          finish();
        } catch { finish("O Codex retornou uma resposta inválida. Nenhuma ação deste turno foi executada."); }
      });
      if (signal.aborted) abort();
      else child.stdin.end(prompt);
    },
    cancel() { stop?.(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}

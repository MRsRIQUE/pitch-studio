"use client";
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SellaOrb } from "@/components/sella/SellaOrb";
import { flushSync } from "react-dom";
import { getToken } from "@/lib/galleryUtils";
import { CHAT_MODEL_GROUPS as MODEL_GROUPS, CHAT_MODELS as MODELS, type ModelId } from "@/lib/models";
import { useChatSessionStore } from "@/lib/chatSessionStore";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { useWorkflowStore } from "@/lib/store";
import { loadAzureBaseUrl, loadAzureTextDeployment, loadAzureTextModelName } from "@/lib/azureSettings";
import { ChatBorderBeam, MetalCommand } from "@/components/ui/ChatEffects";
import "./superficies.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}


/* As telas de canvas: o editor de grafo e a página de projeto. Nas duas a
   conversa já vive na própria tela — como nó, no grafo, e no painel de 368px,
   no projeto —, então a pílula flutuante seria uma segunda porta para a mesma
   coisa. `/workflow` sem barra é o painel de projetos, e ali ela fica. */
function ehTelaDeCanvas(rota: string | null): boolean {
  if (!rota) return false;
  return rota.startsWith("/workflow/") || rota.startsWith("/projeto");
}

export function QuickAssist() {
  const rota = usePathname();
  const naTelaDeCanvas = ehTelaDeCanvas(rota);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const { preferredModel, setPreferredModel } = useChatSessionStore();
  const [model, setModel] = useState<ModelId>(preferredModel as ModelId);
  const [modelOpen, setModelOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /* Cada abertura (clique ou ⌘K) faz o orbe da SELLA na pílula dar um pulinho. */
  const [reacoes, setReacoes] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { createSession, upsertSession } = useChatSessionStore();
  const azureKeySet = useWorkflowStore((s) => s.azureKeySet);
  const disabledIds = azureKeySet === true ? [] : ["azure-auto"];

  // Sync to store when streaming stops
  useEffect(() => {
    if (streaming || !sessionId) return;
    const stored = messages
      .filter(m => !m.streaming && m.content)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (stored.length > 0) upsertSession(sessionId, stored, model);
  }, [streaming, sessionId]);

  useEffect(() => {
    /* Sem pílula, sem atalho: deixar o ⌘K vivo numa tela onde o botão não
       existe é oferecer uma porta que ninguém vê. */
    if (naTelaDeCanvas) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); if (!open) setReacoes(n => n + 1); setOpen(o => !o); }
      if (e.key === "Escape") { setOpen(false); setModelOpen(false); }
    }
    function onPointer(e: PointerEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-model-picker]")) setModelOpen(false);
      if (open && containerRef.current && !containerRef.current.contains(t)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [open, naTelaDeCanvas]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function resetChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
    setSessionId(null);
  }

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // Create session on first message
    let sid = sessionId;
    if (!sid) {
      sid = createSession(model, trimmed.slice(0, 50));
      setSessionId(sid);
    }

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...newMessages, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setStreaming(true);

    const assistantIdx = newMessages.length;
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const token = await getToken();
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
      const azureConfig = model === "azure-auto" ? {
        azureEndpoint:   loadAzureBaseUrl(),
        azureDeployment: loadAzureTextDeployment(),
        azureModelName:  loadAzureTextModelName(),
      } : {};
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          stream: true,
          thinkingFlag: true,
          max_tokens: 1024,
          ...azureConfig,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        let errMsg = "A requisição falhou.";
        try { const j = await res.json(); errMsg = j.error ?? errMsg; } catch { errMsg = await res.text().catch(() => errMsg); }
        setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, content: `Erro: ${errMsg}`, streaming: false } : m));
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const claudeChunk = parsed.type === "content_block_delta" ? parsed.delta?.text : null;
            const openaiChunk = parsed.choices?.[0]?.delta?.content ?? null;
            const chunk = claudeChunk ?? openaiChunk ?? null;
            if (chunk) {
              accumulated += chunk;
              flushSync(() => {
                setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, content: accumulated } : m));
              });
            }
          } catch { /* skip */ }
        }
      }

      setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, streaming: false } : m));
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, content: "A requisição falhou.", streaming: false } : m));
      }
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, model, sessionId, createSession]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
    if (e.key === "Escape") setOpen(false);
  }

  const isEmpty = messages.length === 0;
  const atalho = useAtalho();


  /* O corte fica aqui, depois de todos os hooks: a ordem deles não pode mudar
     entre renders, e a rota muda sem desmontar o componente. */
  if (naTelaDeCanvas) return null;

  return (
    <div ref={containerRef} className="quick-assist-root">
      {/* Pílula que abre o assistente: o orbe da SELLA no círculo à
          esquerda, o rótulo e o selo do atalho em vidro. */}
      <button
        type="button"
        onClick={() => { if (!open) setReacoes(n => n + 1); setOpen(o => !o); }}
        className="qa-pilula"
        aria-keyshortcuts="Meta+K Control+K"
        aria-expanded={open}
      >
        <span className="qa-pilula__avatar">
          <SellaOrb size={34} reagir={reacoes} estado={streaming ? "pensando" : "observando"} />
        </span>
        <span className="qa-pilula__rotulo">Assistente</span>
        <kbd className="qa-pilula__atalho">{atalho}</kbd>
      </button>

      {/* Panel */}
      {open && (
        <div className="ms-superficie-entrada-baixo fixed bottom-[76px] right-6 z-[1001] flex max-h-[600px] w-[380px] flex-col overflow-hidden rounded-ms-2xl border border-ms-border-subtle bg-ms-bg shadow-ms-lg">
          {/* Header */}
          <div className="flex shrink-0 items-center border-b border-ms-border-subtle px-4 pb-3 pt-3.5">
            <SellaOrb size={20} estado={streaming ? "pensando" : "observando"} />
            <span className="ml-2 text-ms-lg font-semibold tracking-[-0.02em] text-ms-text">Assistente</span>
            <div className="ml-auto flex items-center gap-2">
              {!isEmpty && (
                <button
                  onClick={resetChat}
                  title="Nova conversa"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-ms-md border-none bg-ms-bg-component p-0 text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-component-active hover:text-ms-text"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5H9a7 7 0 1 0 6.928 8" /><path d="M15 2l4 3-4 3" /></svg>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-ms-md border-none bg-ms-bg-component p-0 text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-component-active hover:text-ms-text"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* ── Chat area ── */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: isEmpty ? "32px 24px 16px" : "16px", display: "flex", flexDirection: "column", gap: isEmpty ? "0" : "12px", minHeight: 0 }}>
            {isEmpty ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-13 w-13 items-center justify-center rounded-ms-xl bg-ms-bg-brand">
                  <SpinnerIcon size={22} color="var(--ms-solid-brand)" />
                </div>
                <p className="mb-2 mt-0 text-ms-xl font-bold tracking-[-0.02em] text-ms-text">Como posso ajudar?</p>
                <p className="m-0 text-ms-md leading-normal tracking-[-0.01em] text-ms-text-tertiary">Me dê um prompt, eu deixo melhor.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div
                    className={
                      "max-w-[85%] whitespace-pre-wrap break-words border px-3.5 py-2.5 text-ms-md leading-relaxed tracking-[-0.01em] text-ms-text " +
                      (m.role === "user"
                        ? "rounded-[14px_14px_4px_14px] border-transparent bg-ms-bg-brand"
                        : "rounded-[14px_14px_14px_4px] border-ms-border-subtle bg-ms-bg-component")
                    }
                  >
                    {m.content}
                    {m.streaming && (
                      m.content
                        ? <span
                            className="ml-0.5 inline-block h-[13px] w-0.5 rounded-ms-sm bg-ms-text-tertiary align-text-bottom"
                            style={{ animation: "qa-cursor .8s ease-in-out infinite" }}
                          />
                        : <span className="inline-flex items-center gap-[3px]">
                            {[0,1,2].map(d => (
                              <span
                                key={d}
                                className="h-1 w-1 rounded-ms-full bg-ms-text-tertiary"
                                style={{ animation: `qa-ponto 1s ${d * 0.2}s infinite` }}
                              />
                            ))}
                          </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Input ── */}
          <div className="shrink-0 border-t border-ms-border-subtle p-3">
            <ChatBorderBeam className="qa-input-beam" size="sm" strength={0.62} borderRadius={10}>
              <div className="flex items-center gap-2 rounded-ms-lg border border-ms-border-subtle bg-ms-bg-component py-2 pl-3 pr-2 transition-colors duration-150 focus-within:border-ms-border-brand">
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Descreva sua ideia…" rows={1} disabled={streaming}
                  className="max-h-24 flex-1 resize-none overflow-y-auto border-none bg-transparent p-0 tracking-[-0.01em] text-ms-text outline-none placeholder:text-ms-text-placeholder"
                  style={{ fontSize: "13.5px", fontFamily: "inherit", lineHeight: "22px", cursor: streaming ? "not-allowed" : "text" }}
                  onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 96) + "px"; }} />
                <MetalCommand
                  className="qa-send-metal"
                  active={Boolean(input.trim()) && !streaming && !disabledIds.includes(model)}
                  surface={input.trim() && !streaming && !disabledIds.includes(model)
                    ? "var(--ms-solid-brand)"
                    : "var(--ms-bg-component-active)"}
                >
                  <button onClick={() => send(input)} disabled={!input.trim() || streaming || disabledIds.includes(model)}
                    aria-label="Enviar"
                    className={
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-ms-full border-none p-0 transition-colors duration-150 " +
                      (input.trim() && !streaming && !disabledIds.includes(model)
                        ? "ms-botao-marca cursor-pointer"
                        : "cursor-not-allowed bg-ms-bg-component-active text-ms-text-disabled")
                    }>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </MetalCommand>
              </div>
            </ChatBorderBeam>
            <div className="mt-2 flex items-center justify-between px-0.5">
              {/* Seletor de modelo */}
              <div data-model-picker="" className="relative">
                <button onClick={() => setModelOpen(o => !o)}
                  className={
                    "flex cursor-pointer items-center gap-[5px] rounded-ms border border-transparent py-0.5 pl-2 pr-[7px] text-ms-xs font-medium uppercase tracking-[0.04em] transition-colors duration-150 hover:bg-ms-bg-hover hover:text-ms-text-secondary " +
                    (modelOpen ? "bg-ms-bg-hover text-ms-text-secondary" : "bg-transparent text-ms-text-tertiary")
                  }
                  style={{ fontFamily: "inherit" }}>
                  {MODELS.find(m => m.id === model)?.label}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.6 }}><path d="m6 15 6-6 6 6" /></svg>
                </button>
                {modelOpen && (
                  <div
                    className="ms-superficie-entrada absolute left-0 z-10 min-w-45 overflow-hidden rounded-ms-lg border border-ms-border-subtle bg-ms-bg shadow-ms-md"
                    style={{ bottom: "calc(100% + 6px)" }}
                  >
                    <div className="p-1">
                      {MODEL_GROUPS.map((group, gi) => (
                        <div key={group.label}>
                          {gi > 0 && <div className="my-1 h-px bg-ms-border-subtle" />}
                          <div className="px-2 pb-0.5 pt-1 text-ms-xs font-semibold uppercase tracking-[0.06em] text-ms-text-tertiary">{group.label}</div>
                          {group.models.map(m => {
                            const isDisabled = disabledIds.includes(m.id);
                            return (
                            <button key={m.id}
                              onClick={() => { if (!isDisabled) { setModel(m.id); setPreferredModel(m.id); setModelOpen(false); } }}
                              title={isDisabled ? "Configure o Azure em Ajustes → Chaves de API" : undefined}
                              className={
                                "flex w-full items-center justify-between rounded-ms-md border-none px-2 py-[7px] text-left text-ms-md transition-colors duration-100 " +
                                (isDisabled
                                  ? "cursor-not-allowed bg-transparent text-ms-text-disabled"
                                  : model === m.id
                                    ? "cursor-pointer bg-ms-bg-brand font-medium text-ms-text-brand"
                                    : "cursor-pointer bg-transparent text-ms-text-secondary hover:bg-ms-bg-hover")
                              }
                              style={{ fontFamily: "inherit" }}>
                              <span>{m.label}</span>
                              <span className={"ml-2 text-ms-xs " + (isDisabled ? "text-ms-text-disabled" : "text-ms-text-tertiary")}>{isDisabled ? "precisa da chave Azure" : m.desc}</span>
                            </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="flex items-center gap-2 text-ms-xs tracking-[0.03em] text-ms-text-tertiary">
                <span className="flex items-center gap-1">
                  <kbd className="rounded-ms-sm border border-ms-border-subtle bg-ms-bg-component px-1 py-px text-ms-xs text-ms-text-tertiary">↵</kbd>
                  ENVIAR
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded-ms-sm border border-ms-border-subtle bg-ms-bg-component px-1 py-px text-ms-xs text-ms-text-tertiary">ESC</kbd>
                  FECHAR
                </span>
              </span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

function SpinnerIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ⌘K no Mac, Ctrl K no resto. O servidor não sabe a plataforma e responde
   ⌘K; o cliente corrige na hidratação sem aviso de divergência. */
const semAssinatura = () => () => {};
function useAtalho(): string {
  return useSyncExternalStore(
    semAssinatura,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

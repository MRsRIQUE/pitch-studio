"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatSessionStore, type StoredMessage, type ChatSession } from "@/lib/chatSessionStore";
import { getToken } from "@/lib/galleryUtils";
import { PitchMark } from "@/components/PitchLogo";
import { CHAT_MODEL_GROUPS as MODEL_GROUPS, CHAT_MODELS as MODELS, type ModelId } from "@/lib/models";
import { CHAT_PROMPT, contextoChat, executarAcaoChat, workflowDaConversa } from "@/lib/chatActions";
import { lerTurno } from "@/lib/assistantTurno";
import { CodexConnection } from "@/components/assistente/CodexConnection";
import { ChatArtifact } from "@/components/assistente/ChatArtifact";
import { ChevronUp, Copy, Check } from "@/components/icones";
import { useWorkflowStore } from "@/lib/store";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ComposerShell } from "@/components/gallery/Composer/ComposerShell";
import "./chat.css";
import { loadAzureBaseUrl, loadAzureTextDeployment, loadAzureTextModelName } from "@/lib/azureSettings";

// ── Logo ──────────────────────────────────────────────────────────────────────

function LogoIcon({ size = 40 }: { size?: number }) {
  return <PitchMark size={size} />;
}

function ModelPicker({
  model, onChange, disabledIds = [],
}: {
  model: ModelId;
  onChange: (id: ModelId) => void;
  disabledIds?: string[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="pc-pill" aria-label="Modelo de IA">
        {MODELS.find(m => m.id === model)?.label}
        <ChevronUp size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="max-h-80 overflow-y-auto rounded-ms-lg">
        <DropdownMenuRadioGroup value={model} onValueChange={id => onChange(id as ModelId)}>
          {MODEL_GROUPS.map((group, index) => (
            <React.Fragment key={group.label}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.models.map(m => (
                <DropdownMenuRadioItem key={m.id} value={m.id} disabled={disabledIds.includes(m.id)}>
                  {m.label}
                  {disabledIds.includes(m.id) && <span className="ml-2 text-ms-sm text-ms-text-tertiary">Configure a chave {m.id === "azure-auto" ? "Azure" : "Kie.ai"}</span>}
                </DropdownMenuRadioItem>
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Welcome() {
  return (
    <div className="chat-welcome">
      <LogoIcon size={40} />
      <h2 className="text-ms-3xl font-normal text-ms-text">O que vamos criar?</h2>
      <p className="text-ms-lg text-ms-text-secondary">Crie personagens com retratos por IA, monte workflows ou refine seus prompts.</p>
    </div>
  );
}

function ConnectionNotice({ unavailable }: { unavailable: boolean }) {
  if (!unavailable) return null;
  return <p className="text-ms-sm text-ms-text-secondary mt-3">Conecte a chave do provedor para usar este modelo ou selecione um modelo conectado. <button type="button" className="underline" onClick={() => useWorkflowStore.getState().setSettingsOpen(true)}>Abrir configurações</button></p>;
}

function LandingView({
  onSubmit, model, onModelChange, rascunho = "",
}: {
  onSubmit: (text: string) => void;
  model: ModelId;
  onModelChange: (id: ModelId) => void;
  rascunho?: string;
}) {
  const [input, setInput] = useState(rascunho);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const kieKeySet = useWorkflowStore(s => s.kieKeySet);
  const azureKeySet = useWorkflowStore(s => s.azureKeySet);
  const disabledIds = [...(azureKeySet === true ? [] : ["azure-auto"]), ...(kieKeySet === false ? MODELS.filter(m => m.id !== "azure-auto" && m.id !== "codex-chatgpt").map(m => m.id) : [])];

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit() {
    if (input.trim() && !disabledIds.includes(model)) onSubmit(input.trim());
  }

  return (
    <div className="chat-empty">
      <Welcome />
      <div className="chat-composer-placement">
        <ComposerShell
          beam
          value={input}
          onChange={setInput}
          onSubmit={submit}
          disabled={!input.trim() || disabledIds.includes(model)}
          placeholder="Ex.: Crie a Ana, uma apresentadora de skincare, e um workflow de 3 vídeos…"
          submitLabel="Enviar mensagem"
          submitOn="enter"
          maxLength={null}
          textareaRef={inputRef}
          trailing={<ModelPicker model={model} onChange={onModelChange} disabledIds={disabledIds} />}
        />
        {model === "codex-chatgpt" ? <CodexConnection /> : <ConnectionNotice unavailable={disabledIds.includes(model)} />}
      </div>
    </div>
  );
}

// ── Conversa ───────────────────────────────────────────────────────────────

interface LiveMessage extends StoredMessage {
  streaming?: boolean;
}

function ChatWindow({
  session, onUpdate, defaultModel, onModelChange, onAuthRequired, initialMessage,
}: {
  session: ChatSession;
  onUpdate: (msgs: StoredMessage[], model: string) => void;
  defaultModel?: string;
  onModelChange?: (id: ModelId) => void;
  onAuthRequired?: () => void;
  initialMessage?: string;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>(() =>
    session.messages.map((m) => ({ ...m }))
  );
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ModelId>((session.model || defaultModel || "claude-sonnet-4-6") as ModelId);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const kieKeySet   = useWorkflowStore((s) => s.kieKeySet);
  const azureKeySet = useWorkflowStore((s) => s.azureKeySet);
  const disabledIds = [...(azureKeySet === true ? [] : ["azure-auto"]), ...(kieKeySet === false ? MODELS.filter(m => m.id !== "azure-auto" && m.id !== "codex-chatgpt").map(m => m.id) : [])];

  function handleModelChange(id: ModelId) { setModel(id); onModelChange?.(id); }
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || abortRef.current || isStreaming) return;
    if (onAuthRequired) { onAuthRequired(); return; }

    const contextMessages: StoredMessage[] = [
      ...session.messages,
      { role: "user", content: trimmed },
    ];

    setMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        { role: "user", content: trimmed },
        { role: "assistant", content: "", streaming: true },
      ]);
    setInput("");
    setIsStreaming(true);

    onUpdate(contextMessages, model);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const token = await getToken();
      const azureConfig = model === "azure-auto" ? {
        azureEndpoint:   loadAzureBaseUrl(),
        azureDeployment: loadAzureTextDeployment(),
        azureModelName:  loadAzureTextModelName(),
      } : {};

      const history = [...contextMessages];
      let workflowId = workflowDaConversa(history);
      if (workflowId) useWorkflowStore.getState().switchSpace(workflowId);
      for (let round = 0; round < 8; round++) {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ model, tools: "chat", messages: [
            { role: "system", content: `${CHAT_PROMPT}\n\n${contextoChat(workflowId)}` },
            ...history.map(({ role, content, toolCalls, toolCallId }) => ({ role, content, toolCalls, toolCallId })),
          ], ...azureConfig }),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Não foi possível enviar a mensagem.");
        }
        const turno = await lerTurno(res.body, content => setMessages([...history, { role: "assistant", content, streaming: true }]));
        if (turno.falha) throw new Error(turno.falha);
        if (!turno.chamadas.length) {
          history.push({ role: "assistant", content: turno.texto || "Não recebi uma resposta. Tente novamente." });
          onUpdate([...history], model);
          setMessages([...history]);
          return;
        }
        history.push({ role: "assistant", content: turno.texto, toolCalls: turno.chamadas });
        for (const call of turno.chamadas) {
          const result = await executarAcaoChat(call, workflowId);
          history.push(result);
          if (result.artifact?.tipo === "workflow") workflowId = result.artifact.id;
        }
        // Persist complete tool-call/result pairs before requesting the next turn.
        onUpdate([...history], model);
        setMessages([...history, { role: "assistant", content: "", streaming: true }]);
      }
      history.push({ role: "assistant", content: "As ações acima foram salvas. Envie uma nova mensagem para continuar a montagem." });
      onUpdate(history, model);
      setMessages(history);
    } catch (err: unknown) {
      // Keep already completed actions even if the provider fails while narrating them.
      const saved = useChatSessionStore.getState().sessions.find(s => s.id === session.id)?.messages ?? contextMessages;
      const final: StoredMessage[] = [...saved, { role: "assistant", content: (err as Error)?.name === "AbortError" ? "Resposta interrompida. As ações concluídas foram salvas." : `Erro: ${err instanceof Error ? err.message : "Não foi possível enviar a mensagem."}` }];
      onUpdate(final, model);
      setMessages(final);
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [isStreaming, model, onAuthRequired, session, onUpdate]);

  const hasSentInitial = useRef(false);
  useEffect(() => {
    if (initialMessage && !hasSentInitial.current) {
      hasSentInitial.current = true;
      send(initialMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="chat-window">
      <div ref={scrollRef} className="chat-messages" role="log" aria-label="Mensagens da conversa" aria-busy={isStreaming}>
        <div className="chat-container chat-message-list">
          {messages.length === 0 && !isStreaming && <Welcome />}
          {messages.map((m, i) => m.role === "tool" ? (
            <div key={i} className="chat-message chat-message--assistant">
              {m.artifact ? <ChatArtifact artifact={m.artifact} /> : <p className="text-ms-sm text-ms-text-secondary">{m.content}</p>}
            </div>
          ) : !m.content && !m.streaming ? null : (
            <article key={i} className={`chat-message chat-message--${m.role}`} aria-label={m.role === "user" ? "Você" : "Assistente"}>
              <div className="chat-message-text">
                {m.content}
                {m.streaming && (
                  m.content
                    ? <span className="chat-cursor" aria-hidden="true" />
                    : <span className="chat-thinking" role="status">Preparando resposta…</span>
                )}
              </div>
              {m.role === "assistant" && !m.streaming && m.content && (
                <button type="button" className="chat-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(m.content);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 1500);
                    } catch { setCopiedIdx(null); }
                  }}
                  aria-label={copiedIdx === i ? "Resposta copiada" : "Copiar resposta"}
                >
                  {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                  {copiedIdx === i ? "Copiado" : "Copiar"}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="chat-composer-footer">
        <div className="chat-composer-placement">
          <ComposerShell
            beam
            value={input}
            onChange={setInput}
            onSubmit={() => { if (!disabledIds.includes(model)) void send(input); }}
            disabled={!input.trim() || disabledIds.includes(model)}
            busy={isStreaming}
            placeholder="Envie uma mensagem…"
            submitLabel="Enviar mensagem"
            submitOn="enter"
            maxLength={null}
            textareaRef={inputRef}
            trailing={<ModelPicker model={model} onChange={handleModelChange} disabledIds={disabledIds} />}
          />
          {model === "codex-chatgpt" ? <CodexConnection /> : <ConnectionNotice unavailable={disabledIds.includes(model)} />}
        </div>
      </div>
    </div>
  );
}

// ── Sessão selecionada pela URL ────────────────────────────────────────

function ChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const { sessions, createSession, upsertSession, preferredModel, setPreferredModel } = useChatSessionStore();
  const hydrated = useSyncExternalStore(
    useCallback((notify: () => void) => useChatSessionStore.persist.onFinishHydration(notify), []),
    () => useChatSessionStore.persist.hasHydrated(),
    () => false,
  );
  const landingModel = preferredModel as ModelId;
  const [pendingMessage, setPendingMessage] = useState<{ id: string; text: string } | null>(null);

  const activeSession = idParam ? (sessions.find(s => s.id === idParam) ?? null) : null;

  /* `?q=` — quem chega de outra tela com um prompt pronto (o "Criar estilo
     conversando" dos Estilos, por exemplo) cai aqui com o campo preenchido, sem
     mensagem pendurada no histórico: quem envia continua sendo a pessoa. */
  const rascunho = searchParams.get("q") ?? "";

  function handleLandingSubmit(text: string) {
    const id = createSession(landingModel, text.slice(0, 50));
    setPendingMessage({ id, text });
    router.push(`/chat?id=${id}`);
  }

  if (!hydrated) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ms-text-tertiary)", fontSize: "14px" }}>
        Carregando…
      </div>
    );
  }

  return (
    <div className="chat-window">
      <header className="shrink-0 px-6 pt-5">
        <div className="mx-auto w-full max-w-[1310px]">
          <div className="flex h-6 items-center justify-between gap-6">
            <h1 className="truncate text-ms-xl font-normal leading-6 text-ms-text">
              {activeSession?.title || "Assistente"}
            </h1>
          </div>
        </div>
      </header>
      {activeSession ? (
        <ChatWindow
          key={activeSession.id}
          session={activeSession}
          onUpdate={(msgs, mdl) => upsertSession(activeSession.id, msgs, mdl)}
          defaultModel={preferredModel}
          onModelChange={setPreferredModel}
          initialMessage={pendingMessage?.id === activeSession.id && activeSession.messages.length === 0 ? pendingMessage.text : undefined}
        />
      ) : (
        <LandingView
          onSubmit={handleLandingSubmit}
          model={landingModel}
          onModelChange={setPreferredModel}
          rascunho={rascunho}
        />
      )}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  return (
    <div className="chat-page flex-1 flex overflow-hidden min-h-0">
      <Suspense fallback={<div style={{ flex: 1 }} />}>
        <ChatInner />
      </Suspense>
    </div>
  );
}

"use client";

/* ============================================================
   MELHORAR — o `Polish prompt` da referência, construído.

   Reescreve o prompt do campo com o texto chegando em streaming, do
   mesmo jeito que o QuickAssist já conversa com `app/api/assistant`.
   Não há endpoint novo: é o assistente que já existe, com outra
   instrução.

   Duas decisões de comportamento:

   1. O texto original é guardado antes da primeira letra chegar, e
      `undo()` devolve tudo. Reescrita que não dá para desfazer é uma
      afordância que assusta — e o usuário digitou aquilo.
   2. O modelo é o mesmo `preferredModel` do assistente. Um seletor de
      modelo só para melhorar seria um décimo quarto controle, que é
      exatamente o que este trabalho está desfazendo.
   ============================================================ */

import * as React from "react";
import { getToken } from "@/lib/galleryUtils";
import {
  loadAzureBaseUrl,
  loadAzureTextDeployment,
  loadAzureTextModelName,
} from "@/lib/azureSettings";

/** A instrução. Fica aqui, e não em `lib/systemPrompt.ts`, porque é do
    composer — o assistente do chat tem outro trabalho. */
const POLISH_SYSTEM = `Você reescreve prompts de geração de imagem e vídeo.

Receba o rascunho do usuário e devolva UMA versão melhorada dele.

Regras:
- Responda SOMENTE com o prompt reescrito. Sem aspas, sem preâmbulo,
  sem explicação, sem alternativas numeradas.
- Preserve a língua do original. Rascunho em português volta em português.
- Preserve a intenção, o assunto e qualquer restrição explícita
  (proporção, texto que precisa aparecer, marca, contagem).
- Acrescente o que falta para a imagem existir: enquadramento, luz,
  material, paleta, lente, atmosfera. Seja concreto, não adjetivo vago.
- Não invente elementos que mudem o assunto.
- Se o rascunho já estiver bom, devolva-o quase igual em vez de inchá-lo.
- Se o rascunho for JSON ou YAML, devolva no mesmo formato, válido.`;

type PolishState = {
  polishing: boolean;
  error: string | null;
  /** Há um original guardado para `undo()`. */
  canUndo: boolean;
};

export function usePolishPrompt({
  onChange,
  model,
}: {
  onChange: (value: string) => void;
  /** O mesmo `preferredModel` que o assistente usa. */
  model: string;
}) {
  const [state, setState] = React.useState<PolishState>({
    polishing: false,
    error: null,
    canUndo: false,
  });

  const abortRef = React.useRef<AbortController | null>(null);
  const originalRef = React.useRef<string | null>(null);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, polishing: false }));
  }, []);

  const undo = React.useCallback(() => {
    if (originalRef.current === null) return;
    onChange(originalRef.current);
    originalRef.current = null;
    setState((s) => ({ ...s, canUndo: false, error: null }));
  }, [onChange]);

  /**
   * Recebe o rascunho por argumento em vez de ler um ref: `polish` é
   * disparada por clique, então o handler já tem o `value` fresco do
   * momento do evento. Ref escrito no render seria impuro e quebraria
   * sob renderização concorrente.
   */
  const polish = React.useCallback(async (draftRaw: string) => {
    const draft = draftRaw.trim();
    if (!draft || abortRef.current) return;

    originalRef.current = draftRaw;
    setState({ polishing: true, error: null, canUndo: false });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const azure =
        model === "azure-auto"
          ? {
              azureEndpoint: loadAzureBaseUrl(),
              azureDeployment: loadAzureTextDeployment(),
              azureModelName: loadAzureTextModelName(),
            }
          : {};

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: POLISH_SYSTEM },
            { role: "user", content: draft },
          ],
          stream: true,
          max_tokens: 1024,
          ...azure,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "A reescrita falhou.";
        try {
          const j = await res.json();
          msg = j.error ?? msg;
        } catch {
          /* resposta sem corpo JSON — fica a mensagem padrão */
        }
        setState({ polishing: false, error: msg, canUndo: true });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let out = "";
      let wroteSomething = false;
      /* O upstream responde 200 e só então manda `event: error` dentro do
         próprio stream (ex.: `no_available_account`). Sem ler isso, uma
         falha de conta viraria o genérico "não devolveu texto". */
      let erroDoStream: string | null = null;

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            if (parsed.type === "error") {
              erroDoStream = parsed.error?.message ?? "erro do modelo";
              continue;
            }
            /* O endpoint fala dois dialetos: o da Anthropic e o
               compatível com OpenAI. O QuickAssist já lê os dois. */
            const piece =
              (parsed.type === "content_block_delta" ? parsed.delta?.text : null) ??
              parsed.choices?.[0]?.delta?.content ??
              null;
            if (piece) {
              out += piece;
              wroteSomething = true;
              onChange(out);
            }
          } catch {
            /* linha parcial ou keep-alive */
          }
        }
      }

      if (!wroteSomething) {
        /* Sem uma letra sequer, devolver o campo vazio seria destruir o
           rascunho por causa de um erro do modelo. */
        onChange(originalRef.current ?? "");
        setState({
          polishing: false,
          error: erroDoStream ?? "O modelo não devolveu texto.",
          canUndo: false,
        });
        return;
      }

      setState({ polishing: false, error: null, canUndo: true });
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        onChange(originalRef.current ?? draftRaw);
        setState({ polishing: false, error: null, canUndo: false });
        return;
      }
      onChange(originalRef.current ?? draftRaw);
      setState({ polishing: false, error: "A reescrita falhou.", canUndo: false });
    } finally {
      abortRef.current = null;
    }
  }, [model, onChange]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return { ...state, polish, cancel, undo };
}

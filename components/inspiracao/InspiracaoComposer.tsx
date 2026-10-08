"use client";

/* ============================================================
   MINI-COMPOSER PRESO AO RODAPÉ

   O `._chatInputWrapper.is-collapsed` do bloco 05: uma caixa de 48px que fica
   `sticky` a 24px do fundo da rolagem, com o botão de enviar à direita (a caixa
   é `row-reverse`, por isso ele vem antes no DOM e aparece depois na tela) e um
   texto que se digita sozinho por cima do campo, com a pílula `Tab` que aceita
   a sugestão.

   A sugestão é dado real: são os prompts das gerações que a página já carregou.
   Sem geração nenhuma não há o que sugerir, e aí o campo fica com um marcador
   estático em vez de fingir que tem repertório.

   Enviar leva ao composer com o prompt escrito — o mesmo caminho do Remixar,
   pelo `lib/remixHandoff.ts`.
   ============================================================ */

import * as React from "react";
import { ChatBorderBeam, MetalCommand } from "@/components/ui/ChatEffects";

/** Cadência da digitação e a pausa com a frase inteira na tela, antes da próxima. */
const PASSO_MS = 45;
const PAUSA_MS = 2200;

function movimentoReduzido(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const IconeEnviar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    style={{ position: "relative", left: "-.5px", top: ".5px" }}>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);

export function InspiracaoComposer({
  sugestoes,
  onEnviar,
}: {
  /** Prompts reais das gerações carregadas, na ordem em que devem ser digitados. */
  sugestoes: string[];
  onEnviar: (prompt: string) => void;
}) {
  const [texto, setTexto] = React.useState("");
  const [indice, setIndice] = React.useState(0);
  const [passo, setPasso] = React.useState(0);

  const alvo = sugestoes.length > 0 ? sugestoes[indice % sugestoes.length] : "";

  /* Um passo por vez, com pausa no fim da frase. O `setState` mora no callback
     do temporizador, nunca no corpo do efeito. */
  React.useEffect(() => {
    if (texto || !alvo) return;
    if (passo < alvo.length) {
      const reduzido = movimentoReduzido();
      const id = window.setTimeout(
        () => setPasso(atual => (reduzido ? alvo.length : atual + 1)),
        reduzido ? 0 : PASSO_MS,
      );
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setPasso(0);
      setIndice(atual => atual + 1);
    }, PAUSA_MS);
    return () => window.clearTimeout(id);
  }, [texto, alvo, passo]);

  const enviar = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    onEnviar(limpo);
  };

  const mostrarSugestao = !texto && alvo.length > 0;

  return (
    <div className="insp-chat">
      <div className="insp-chat__inner">
        <ChatBorderBeam className="insp-chat-wrapper" size="sm" strength={0.62} borderRadius={18}>
          <div className="insp-chat-box">
            <MetalCommand
              className="insp-send-metal"
              active={Boolean(texto.trim())}
              surface={texto.trim() ? "var(--app-v2-brand-solid)" : "var(--app-v2-bg-component)"}
            >
              <button
                type="button"
                className="insp-chat-send"
                aria-label="Abrir no Criar com este prompt"
                disabled={!texto.trim()}
                onClick={enviar}
              >
                <IconeEnviar />
              </button>
            </MetalCommand>

            <div className="insp-chat-surface">
              {mostrarSugestao && (
                <div className="insp-typewriter" aria-hidden>
                  <span className="insp-hint-tab">Tab</span>
                  <span className="insp-typewriter-text">{alvo.slice(0, passo)}</span>
                </div>
              )}
              <input
                className="insp-chat-input"
                value={texto}
                onChange={event => setTexto(event.target.value)}
                /* Sem repertório o campo diz o que faz, em vez de ficar mudo. */
                placeholder={mostrarSugestao ? "" : "Descreva o que você quer criar"}
                aria-label="Prompt para levar ao Criar"
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    enviar();
                    return;
                  }
                  /* A pílula `Tab` só intercepta a tecla quando existe mesmo uma
                     sugestão a aceitar; fora disso o Tab segue navegando. */
                  if (event.key === "Tab" && mostrarSugestao) {
                    event.preventDefault();
                    setTexto(alvo);
                  }
                }}
              />
            </div>
          </div>
        </ChatBorderBeam>
      </div>
    </div>
  );
}

"use client";

/* ============================================================
   COMPOSER SHELL

   A superfície do composer, e só ela. Este componente não sabe o que
   é geração, nem o que é conversa: recebe texto, devolve texto e
   avisa quando o usuário pediu para enviar. Tudo que é específico de
   uma tela entra pelos slots (`leading`, `trailing`, `above`,
   `overlay`, `band`).

   É por isso que o Acervo e o Chat podem dividir a mesma barra: o que
   muda entre as duas telas são os controles, não a caixa.

   Geometria e brilho vêm do bloco 03 da referência; os números estão
   comentados em `app/gallery/composer.css`.
   ============================================================ */

import * as React from "react";
import "@/app/gallery/composer.css";
import { ChatBorderBeam, MetalCommand } from "@/components/ui/ChatEffects";
import { useTypewriter } from "./useTypewriter";

export type ComposerSubmitOn = "enter" | "mod-enter";

export type ComposerShellProps = {
  /** Texto do campo. Controlado — o shell nunca guarda o valor. */
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando o atalho de envio dispara ou o botão é clicado. */
  onSubmit: () => void;

  /** Desabilita o envio (o campo continua editável). */
  disabled?: boolean;
  /** Em curso: o botão vira spinner e o envio não dispara. */
  busy?: boolean;

  /**
   * Texto do campo vazio. Uma string é placeholder comum; um array
   * liga o typewriter, e aí `Tab` aceita a frase inteira.
   */
  placeholder?: string | string[];

  /** `null` (ou ausente) esconde o contador. */
  maxLength?: number | null;

  /** Fila esquerda da barra — os botões de ícone. */
  leading?: React.ReactNode;
  /** Fila direita da barra, antes do contador — as pílulas. */
  trailing?: React.ReactNode;
  /** Acima do campo — trilha de anexos, tiras de modo. */
  above?: React.ReactNode;
  /** Sobre o campo — camada de chips desenhada por cima do texto. */
  overlay?: React.ReactNode;
  /**
   * Faixa abaixo da superfície branca. É o slot que reabre os 206px do
   * shell da referência; sem ele o shell tem 164px.
   */
  band?: React.ReactNode;

  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /**
   * Roda ANTES do atalho de envio. Chamar `preventDefault()` cancela o
   * envio do shell — é o escape, não o substituto.
   */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  /** Rótulo do botão. Vai para o texto visível e para o `aria-label`. */
  submitLabel?: string;
  /**
   * `"mod-enter"` (padrão): ⌘/Ctrl+Enter envia, Enter quebra linha.
   * `"enter"`: Enter envia, Shift+Enter quebra linha.
   * A dica ao lado do rótulo sai daqui, então nunca mente sobre o atalho.
   */
  submitOn?: ComposerSubmitOn;
  /** Substitui a dica derivada de `submitOn`. */
  submitHint?: React.ReactNode;

  /** Desliga o brilho animado do shell. */
  glow?: boolean;
  /** Faz o brilho percorrer a borda nas superfícies de conversa. */
  beam?: boolean;
  /** O shell ocupa a altura do pai em vez dos 164px. */
  expanded?: boolean;

  className?: string;
  id?: string;
  /** Marca o campo como ocupado por outra escrita (ex.: "melhorar"). */
  fieldBusy?: boolean;
};

const SendIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);

export function ComposerShell({
  value,
  onChange,
  onSubmit,
  disabled = false,
  busy = false,
  placeholder,
  maxLength = null,
  leading,
  trailing,
  above,
  overlay,
  band,
  textareaRef,
  onKeyDown,
  submitLabel = "Gerar",
  submitOn = "mod-enter",
  submitHint,
  glow = true,
  beam = false,
  expanded = false,
  className,
  id,
  fieldBusy = false,
}: ComposerShellProps) {
  const phrases = React.useMemo(
    () => (Array.isArray(placeholder) ? placeholder : []),
    [placeholder],
  );
  const hasText = value.length > 0;

  const reduced = usePrefersReducedMotion();
  const { text: typed, phrase } = useTypewriter({
    phrases,
    enabled: phrases.length > 0 && !hasText && !reduced,
  });

  const canSubmit = !disabled && !busy;

  const trySubmit = React.useCallback(() => {
    if (!canSubmit) return;
    onSubmit();
  }, [canSubmit, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    /* `Tab` aceita a frase sugerida em vez de sair do campo. */
    if (e.key === "Tab" && !e.shiftKey && phrases.length > 0 && !hasText && phrase) {
      e.preventDefault();
      onChange(phrase);
      return;
    }

    if (e.key !== "Enter") return;

    if (submitOn === "enter") {
      if (e.shiftKey) return; // quebra linha
      e.preventDefault();
      trySubmit();
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      trySubmit();
    }
  };

  const hint =
    submitHint !== undefined ? submitHint : <ModShortcut submitOn={submitOn} />;

  const overLimit = maxLength !== null && value.length > maxLength;

  const shell = (
    <div
      id={id}
      className={`pc-shell${className ? ` ${className}` : ""}`}
      data-expanded={expanded ? "true" : undefined}
      data-glow={glow ? undefined : "off"}
      style={glow ? undefined : { background: "var(--ms-bg-component)" }}
    >
      <div className="pc-surface">
        {above}

        <div className="pc-field">
          <textarea
            ref={textareaRef}
            className="pc-textarea"
            data-polishing={fieldBusy ? "true" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            /* Com typewriter o placeholder nativo sairia por baixo do
               overlay; sem ele, é o placeholder normal. */
            placeholder={typeof placeholder === "string" ? placeholder : undefined}
            aria-label={submitLabel}
            spellCheck={false}
          />

          {overlay}

          {phrases.length > 0 && !hasText && (
            <div className="pc-typewriter" aria-hidden>
              <span className="pc-tab-hint">Tab</span>
              <span className="pc-typewriter-text">{reduced ? phrase : typed}</span>
            </div>
          )}
        </div>

        <div className="pc-toolbar">
          <div className="pc-toolbar-left">{leading}</div>

          <div className="pc-toolbar-right">
            {trailing}

            {maxLength !== null && (
              <div className="pc-counter" data-over={overLimit ? "true" : undefined} aria-hidden>
                {value.length.toLocaleString("pt-BR")}/{maxLength.toLocaleString("pt-BR")}
              </div>
            )}

            <MetalCommand
              className="pc-send-metal"
              active={canSubmit}
              variant={canSubmit && hint ? "button" : "circle"}
              surface={canSubmit ? "var(--app-v2-brand-solid)" : "var(--ms-bg-component)"}
            >
              <button
                type="button"
                className="pc-send"
                onClick={trySubmit}
                disabled={!canSubmit}
                aria-label={busy ? `${submitLabel} — em curso` : submitLabel}
              >
                {busy ? <span className="pc-send-spinner" aria-hidden /> : <SendIcon />}
                {canSubmit && hint ? (
                  <span className="pc-send-hint" aria-hidden>
                    {hint}
                  </span>
                ) : null}
              </button>
            </MetalCommand>
          </div>
        </div>
      </div>

      {band ? <div className="pc-band">{band}</div> : null}
    </div>
  );

  if (!beam) return shell;

  return (
    <ChatBorderBeam
      className={`pc-border-beam${expanded ? " is-expanded" : ""}`}
      size="md"
      strength={0.7}
      borderRadius={20}
    >
      {shell}
    </ChatBorderBeam>
  );
}

/* As duas leituras abaixo vêm do navegador, não do React, e por isso
   passam por `useSyncExternalStore`: o servidor devolve o valor neutro
   e o cliente corrige na hidratação, sem um render extra. */

const noSubscribe = () => () => {};

/** A dica do atalho, com o modificador da plataforma de quem está lendo. */
function ModShortcut({ submitOn }: { submitOn: ComposerSubmitOn }) {
  const mac = React.useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  if (submitOn === "enter") return <>↵</>;
  return <>{mac ? "⌘" : "Ctrl"}↵</>;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(REDUCED_MOTION);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

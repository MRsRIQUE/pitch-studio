"use client";

/* ============================================================
   PRÉVIA DA PEÇA

   No Miora o card abre o projeto que gerou a peça — conversa e canvas voltam
   inteiros. Nós não guardamos projeto por geração, então abrir leva ao que
   existe de fato: a mídia em tamanho grande, o prompt inteiro (o card só mostra
   duas linhas) e os parâmetros que ficaram gravados.

   Daqui saem as duas ações reais: remixar no composer e copiar o prompt.
   ============================================================ */

import * as React from "react";
import { X, Copy, Check } from "@/components/icones";
import type { GalleryItem } from "@/lib/galleryUtils";

export function InspiracaoPreview({
  item,
  onClose,
  onRemix,
}: {
  item: GalleryItem;
  onClose: () => void;
  onRemix: (item: GalleryItem) => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const prompt = item.prompt?.trim();
  const specs = [item.model, item.aspect_ratio, item.quality, item.azure_resolution].filter(Boolean);

  return (
    <div
      className="insp-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Prévia da geração"
      /* O clique no fundo fecha; o clique dentro do painel não sobe. */
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="insp-preview__panel">
        <button ref={closeRef} type="button" className="insp-preview__close" onClick={onClose} aria-label="Fechar prévia">
          <X size={16} strokeWidth={2} />
        </button>

        <div className="insp-preview__media">
          {item.mediaType === "video" ? (
            <video src={item.url} controls autoPlay loop playsInline />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.url} alt={prompt ?? "Geração"} />
          )}
        </div>

        <div className="insp-preview__info">
          {prompt ? <p className="insp-preview__prompt">{prompt}</p> : <p className="insp-preview__prompt is-empty">Esta geração não guardou prompt.</p>}
          {specs.length > 0 && <p className="insp-preview__specs">{specs.join(" · ")}</p>}

          <div className="insp-preview__actions">
            {prompt && (
              <button type="button" className="insp-preview__primary" onClick={() => onRemix(item)}>
                Remixar
              </button>
            )}
            {prompt && (
              <button
                type="button"
                className="insp-preview__secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch { /* área de transferência negada: o botão simplesmente não confirma */ }
                }}
              >
                {copied ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={2} />}
                {copied ? "Copiado" : "Copiar prompt"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

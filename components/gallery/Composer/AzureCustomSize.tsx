"use client";

/* ============================================================
   TAMANHO PERSONALIZADO (Azure)

   Só o gpt-image-2 servido pela Azure aceita largura e altura livres,
   e as regras dele não são óbvias: múltiplos de 16, proporção máxima
   de 3:1, e um total de pixels entre 655.360 e 8.294.400.

   Esta linha existe porque `azureCustomWidth` e `azureCustomHeight`
   alimentam a geração de verdade. Quando o antigo `AspectRatioDropdown`
   saiu, os dois estados continuaram chegando à API sem nenhuma tela que
   os definisse — parâmetro vivo sem afordância. Isto devolve a
   afordância, com a validação literal de `lib/modelConfig`.
   ============================================================ */

import * as React from "react";
import { AZURE_POPULAR_SIZES, validateAzureCustomSize } from "@/lib/modelConfig";
import "@/app/gallery/composer.css";

export function AzureCustomSize({
  width,
  height,
  onApply,
}: {
  width?: number;
  height?: number;
  onApply: (w: number, h: number) => void;
}) {
  const [w, setW] = React.useState(width ?? 1024);
  const [h, setH] = React.useState(height ?? 1024);

  const erro = validateAzureCustomSize(w, h);

  return (
    <div className="flex flex-col gap-2 px-2 py-1">
      <div className="flex items-center gap-1.5">
        <NumeroDeAresta valor={w} aoMudar={setW} rotulo="Largura" />
        <span className="text-ms-text-tertiary">×</span>
        <NumeroDeAresta valor={h} aoMudar={setH} rotulo="Altura" />
        <button
          type="button"
          disabled={!!erro}
          onClick={() => onApply(w, h)}
          className="ml-auto h-6 rounded-ms px-2 text-ms-sm text-ms-text-on-brand transition-colors disabled:cursor-default disabled:bg-ms-bg-component disabled:text-ms-text-disabled"
          style={!erro ? { background: "var(--app-v2-brand-solid)" } : undefined}
        >
          Aplicar
        </button>
      </div>

      {erro ? (
        <span className="text-ms-sm text-ms-text-danger">{erro}</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {AZURE_POPULAR_SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setW(s.width);
                setH(s.height);
                onApply(s.width, s.height);
              }}
              className="h-5 rounded-ms-full bg-ms-bg-component px-2 text-ms-xs text-ms-text-secondary transition-colors hover:bg-ms-bg-component-hover"
            >
              {s.width}×{s.height}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NumeroDeAresta({
  valor,
  aoMudar,
  rotulo,
}: {
  valor: number;
  aoMudar: (n: number) => void;
  rotulo: string;
}) {
  return (
    <input
      type="number"
      aria-label={rotulo}
      value={valor}
      min={16}
      max={3840}
      step={16}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) aoMudar(n);
      }}
      className="w-[68px] rounded-ms border border-ms-border-subtle bg-ms-bg-component px-2 py-0.5 text-right text-ms-base tabular-nums text-ms-text outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
    />
  );
}

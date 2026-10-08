"use client";

/* ============================================================
   PÍLULA 4 — MODO DE EXECUÇÃO

   `Current: auto execution (generate directly)` na referência: alterna
   entre gerar direto e mostrar o cartão de parâmetros antes.

   A pílula tem forma própria — não é a `.pc-pill` das outras. Na
   referência ela é `min-width:75px`, sem borda, raio 30, e o fundo só
   aparece no hover. É o que a separa das pílulas de valor à direita:
   esta é um interruptor, não um seletor.

   O menu é o compacto de 138px medido em
   `estados/composer-modo-execucao.png` — ícone, rótulo e o check no
   escolhido. As descrições longas do i18n não entram nele.
   ============================================================ */

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ROTULO_MODO,
  TOOLTIP_MODO,
  DESCRICAO_MODO,
  type ModoExecucao,
} from "@/lib/modoExecucao";
import "@/app/gallery/composer.css";

/** `<path>` literal do site: círculo com o visto. */
function IconeDireto() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function IconeConfirmar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/** O chevron de 16px da pílula, literal do data-URI do site. */
function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="pcx-exec-chevron">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const OPCOES: { valor: ModoExecucao; icone: React.ReactNode }[] = [
  { valor: "auto", icone: <IconeDireto /> },
  { valor: "confirmar", icone: <IconeConfirmar /> },
];

export function PilulaModoExecucao({
  valor,
  onChange,
  disabled,
  positionerClassName,
}: {
  valor: ModoExecucao;
  onChange: (v: ModoExecucao) => void;
  disabled?: boolean;
  /** O menu nasce num portal com `z-50`. Sobre o painel do projeto
      (`z-index: 230`) ele ficaria por baixo — quem monta a pílula lá
      passa um z maior. */
  positionerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="pcx-exec-pill"
        disabled={disabled}
        aria-label={TOOLTIP_MODO[valor]}
        title={TOOLTIP_MODO[valor]}
      >
        {valor === "auto" ? <IconeDireto /> : <IconeConfirmar />}
        <span className="pcx-exec-rotulo">{ROTULO_MODO[valor]}</span>
        <Chevron />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={10} positionerClassName={positionerClassName} className="w-[138px] p-1.5">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            className="pcx-exec-opcao"
            aria-checked={o.valor === valor}
            role="menuitemradio"
            title={DESCRICAO_MODO[o.valor]}
            onClick={() => onChange(o.valor)}
          >
            <span className="pcx-exec-opcao-icone" aria-hidden>{o.icone}</span>
            <span className="pcx-exec-opcao-rotulo">{ROTULO_MODO[o.valor]}</span>
            <svg className="pcx-exec-opcao-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

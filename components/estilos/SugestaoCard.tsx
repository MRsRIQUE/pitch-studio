"use client";

/* ============================================================
   CARTÃO DE SUGERIDO — `.skills-v2-not-installed-card`

   Estrutura um-para-um com a referência: `__main` (ícone 64 + `__info`) e o
   botão `+` de 28×28 no canto, com `justify-content:space-between` entre os
   dois. Dentro do `__info`, as três linhas: nome + versão, o contador, e a
   descrição de uma linha só, truncada.

   O contador da referência é `downloads`, com um `lucide-download`. O nosso é
   quantas vezes o fragmento já foi aplicado no composer — número contado no
   store. O glifo muda junto com o dado: baixar e aplicar não são a mesma coisa,
   e um ícone de download num número de aplicações seria o mesmo tipo de mentira
   que inventar o número.
   ============================================================ */

import { Plus, Sparkles } from "@/components/icones";
import type { Sugestao } from "@/components/estilos/sugestoes";

export function SugestaoCard({
  sugestao,
  aplicacoes,
  onOpen,
  onAdd,
}: {
  sugestao: Sugestao;
  /** Quantas vezes um estilo vindo deste ponto de partida já foi aplicado. */
  aplicacoes: number;
  onOpen: (sugestao: Sugestao) => void;
  onAdd: (sugestao: Sugestao) => void;
}) {
  const monogram = sugestao.name.trim().slice(0, 1) || "E";

  return (
    <article
      className="est-suggestion"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(sugestao)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(sugestao);
        }
      }}
    >
      <div className="est-suggestion__main">
        <div className="est-card__mark" aria-hidden>{monogram}</div>
        <div className="est-suggestion__info">
          <div className="est-suggestion__title-row">
            <p className="est-suggestion__name" title={sugestao.name}>{sugestao.name}</p>
            <span className="est-suggestion__version">{sugestao.version}</span>
          </div>
          <span className="est-suggestion__count">
            <Sparkles size={16} strokeWidth={1.5} aria-hidden />
            {aplicacoes}
            <span className="sr-only"> aplicações</span>
          </span>
          <p className="est-suggestion__fragment" title={sugestao.fragment}>{sugestao.fragment}</p>
        </div>
      </div>

      <button
        type="button"
        className="est-suggestion__add"
        onClick={event => {
          event.stopPropagation();
          onAdd(sugestao);
        }}
        aria-label={`Adicionar ${sugestao.name} aos meus estilos`}
        title="Adicionar aos meus estilos"
      >
        <Plus size={20} strokeWidth={1.5} aria-hidden />
      </button>
    </article>
  );
}

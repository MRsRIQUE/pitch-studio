"use client";

/* ============================================================
   O CABEÇALHO DO PAINEL — duas linhas, 32 e 40

   Linha do projeto: marca de 32, título editável no lugar (o `title` da
   referência é literal — `workflow.clickToEdit`) e o botão que esconde
   o painel.

   Linha da sessão: o título da conversa e as três ações do i18n —
   `New chat`, `Current project usage`, `History`. As três existem
   porque a referência as tem; o INFO.md ainda observa que é justamente
   esse trio que mantém o custo visível o tempo todo.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PanelLeftIcon,
  MessageSquare,
  Sparkles,
  LayoutGrid,
} from "@/components/icones";
import { PitchMark } from "@/components/PitchLogo";
import "@/components/projeto/painel.css";

export function PainelCabecalho({
  tituloProjeto,
  tituloSessao,
  onRenomearProjeto,
  onNovaSessao,
  onColapsar,
}: {
  tituloProjeto: string;
  tituloSessao: string;
  onRenomearProjeto: (titulo: string) => void;
  onNovaSessao: () => void;
  onColapsar: () => void;
}) {
  const router = useRouter();

  /* O campo é NÃO controlado, com `key` no título: quando o store muda
     — outra aba, outro projeto — o React remonta o campo com o valor
     novo. Um estado espelhado por efeito faria a mesma coisa com um
     render a mais e uma cascata de re-renders no caminho. */
  const confirmar = (el: HTMLInputElement) => {
    const limpo = el.value.trim();
    if (!limpo) { el.value = tituloProjeto; return; }
    if (limpo !== tituloProjeto) onRenomearProjeto(limpo);
  };

  return (
    <header className="pj-cabecalho">
      <div className="pj-linha-projeto">
        <div className="pj-projeto-titulo">
          {/* O mascote da referência é IP da Tencent; o mapa já resolve
              isso no bloco 08 trocando pela marca.

              A marca é o caminho de volta: esta tela é full-bleed e não tem
              a barra lateral, então sem isto não haveria como sair dela sem
              o botão do navegador. */}
          <button
            type="button"
            className="pj-marca"
            title="Voltar para o Criar"
            aria-label="Voltar para o Criar"
            onClick={() => router.push("/gallery?view=create")}
          >
            <PitchMark size={32} />
          </button>
          <input
            key={tituloProjeto}
            className="pj-titulo-campo"
            defaultValue={tituloProjeto}
            title="Clique para editar o título"
            aria-label="Título do projeto"
            maxLength={80}
            onBlur={(e) => confirmar(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.currentTarget.blur(); return; }
              if (e.key === "Escape") { e.currentTarget.value = tituloProjeto; e.currentTarget.blur(); }
            }}
          />
        </div>

        <button
          type="button"
          className="pj-btn-cabecalho"
          onClick={onColapsar}
          title="Esconder o painel"
          aria-label="Esconder o painel"
        >
          <PanelLeftIcon size={16} />
        </button>
      </div>

      <div className="pj-linha-sessao">
        <span className="pj-sessao-titulo" title={tituloSessao}>{tituloSessao}</span>

        <div className="pj-sessao-acoes">
          <button
            type="button"
            className="pj-btn-cabecalho"
            onClick={onNovaSessao}
            title="Nova conversa"
            aria-label="Nova conversa"
          >
            <MessageSquare size={16} />
          </button>

          {/* `Current project usage`. O nosso saldo é real e vive nos
              ajustes de crédito; daqui se chega lá. */}
          <button
            type="button"
            className="pj-btn-cabecalho"
            onClick={() => window.dispatchEvent(new Event("credits-refresh"))}
            title="Consumo do projeto"
            aria-label="Consumo do projeto"
          >
            <Sparkles size={16} />
          </button>

          <button
            type="button"
            className="pj-btn-cabecalho"
            onClick={() => router.push("/chat")}
            title="Histórico de conversas"
            aria-label="Histórico de conversas"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

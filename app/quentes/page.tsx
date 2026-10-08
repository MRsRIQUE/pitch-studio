"use client";

/* ============================================================
   PRODUTOS QUENTES — a tela

   O mesmo conteúdo que vive no painel da direita da tela de projeto,
   agora com a largura inteira. Não são duas implementações: é o mesmo
   `PainelQuentes`, com `variante="pagina"`.

   Vale dizer por que os dois existem, porque parece repetição e não é:

   - No PAINEL, o produto está a um clique do grafo que está atrás. É
     onde se monta a cena sem sair do projeto.
   - Aqui, há espaço para PROCURAR. São 122 produtos, com busca, filtro
     por origem e cartão grande o bastante para a foto do produto ser
     lida antes de a pessoa decidir. No painel de 410px isso é um
     desconforto; aqui é o trabalho.

   O botão "Usar" daqui monta a cena no projeto aberto por último e leva
   o usuário até ele — senão a cena nasceria num grafo que ninguém está
   vendo. Está em `PainelQuentes`, junto da razão.

   A casca (`flex-1 overflow-y-auto px-6 py-5` + coluna com `max-width`)
   é a mesma de `/estilos` e das outras telas de conteúdo.
   ============================================================ */

import { PainelQuentes } from "@/components/produtos/PainelQuentes";

export default function QuentesPage() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="qt-page">
        <header className="qt-header">
          <h1 className="qt-title">Produtos quentes</h1>
          <p className="qt-sub">
            O que está vendendo, direto da base do PitchAI. Limpe a foto do anúncio e mande o
            produto para uma cena com o seu personagem.
          </p>
        </header>

        <PainelQuentes variante="pagina" />
      </div>
    </div>
  );
}

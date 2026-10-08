"use client";

/* ============================================================
   A HOME DE CRIAÇÃO — a montagem dos blocos 02, 03 e 04

   Este arquivo não desenha nada: ele empilha, na ordem da referência, o que
   cada frente entregou.

     banner (bloco 02, Brasa)   → BannerCarrossel
     abas + composer (bloco 03) → montados no próprio app/gallery/page.tsx,
                                  porque dependem do estado da geração
     linha de estilos (04a)     → EstilosSugeridos
     inspiração (04b)           → InspiracaoDestaque

   O que a versão anterior tinha aqui e **saiu**, por não existir na Home do
   Miora: a linha "Seu espaço criativo / Abrir acervo", a headline centralizada
   "O que vamos criar hoje?" com subtítulo, e o segmentado Imagem/Vídeo/Workflow.
   O meio (imagem ou vídeo) é escolhido no popover do modelo, que é onde a
   referência o coloca; o carrossel chapado com três cartões deu lugar ao palco
   3D de verdade.
   ============================================================ */

import BannerCarrossel from "@/components/home/BannerCarrossel";
import { EstilosSugeridos } from "@/components/home/EstilosSugeridos";
import { InspiracaoDestaque } from "@/components/home/InspiracaoDestaque";

/** O que fica ACIMA do composer: o carrossel de banners. */
export function CreationHero() {
  return (
    <section className="miora-empty">
      <BannerCarrossel />
    </section>
  );
}

/** O que fica ABAIXO do composer: a linha de estilos e a inspiração em destaque.
 *
 *  As duas seções declaram `max-width` mas **não se centralizam** (`margin: 0`):
 *  elas contam com a coluna centrada da referência, que é o mesmo container onde
 *  o banner e o composer vivem. Sem ela a linha encostava na barra lateral e a
 *  grade de destaque saía 1928px de largura, começando à esquerda da própria
 *  navegação — o cabeçalho aparecia cortado. A coluna é esta. */
export function CreationSuggestions() {
  return (
    <div className="pitch-home-col">
      <EstilosSugeridos />
      <InspiracaoDestaque />
    </div>
  );
}

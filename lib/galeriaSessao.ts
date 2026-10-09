"use client";

/* ============================================================
   A GAVETA DA GALERIA — estado da janela, não do projeto

   Mesmo desenho que o `painelAberto` de `lib/projetoSessao.ts`: um booleano
   guardado por janela, não por projeto. Quem fechou a galeria fechou porque
   quer o canvas inteiro, e essa vontade não muda ao trocar de projeto.

   Arquivo próprio em vez de um campo a mais no `projetoSessao`: aquele
   arquivo é o contrato entre as três frentes do bloco 09 (painel, canvas e
   ciclo) e não é meu para editar. A galeria é uma quarta superfície e paga o
   seu próprio estado.

   A largura mora aqui pelo mesmo motivo: ela alimenta o `--gal-largura` da
   raiz, e é esse número que faz a pílula do topo e a barra de visualização do
   rodapé recuarem em vez de ficarem por baixo do painel.
   ============================================================ */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Medida no BoardUI; o limite do arrasto é escolha nossa (ver leva 8). */
export const GAL_LARGURA_PADRAO = 410;
export const GAL_LARGURA_MIN = 320;
export const GAL_LARGURA_MAX = 820;

interface GaleriaSessao {
  aberta: boolean;
  largura: number;
  alternar: () => void;
  abrir: () => void;
  fechar: () => void;
  definirLargura: (largura: number) => void;
}

export const useGaleriaSessao = create<GaleriaSessao>()(
  persist(
    (set) => ({
      /* Nasce FECHADA. O canvas é o motivo de a tela existir, e o painel de
         chat já leva 368px da esquerda; abrir a galeria por padrão tiraria
         mais 410 de quem nunca pediu por ela. Quem abre, mantém aberta. */
      aberta: false,
      largura: GAL_LARGURA_PADRAO,

      alternar: () => set((e) => ({ aberta: !e.aberta })),
      abrir: () => set({ aberta: true }),
      fechar: () => set({ aberta: false }),
      definirLargura: (largura) =>
        set({ largura: Math.min(GAL_LARGURA_MAX, Math.max(GAL_LARGURA_MIN, Math.round(largura))) }),
    }),
    {
      name: "pitch-galeria-projeto",
      storage: createJSONStorage(() => localStorage),
      partialize: (estado) => ({ aberta: estado.aberta, largura: estado.largura }),
    },
  ),
);

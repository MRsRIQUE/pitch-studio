/* ============================================================
   OS PRODUTOS DO USUÁRIO — o que sobra depois do recorte

   A lista de quentes vem do PitchAI e é dele; este store guarda a nossa
   parte: quais produtos foram recortados, onde ficou a foto limpa e
   quais estão marcados para entrar na próxima cena.

   O recorte custa uma geração. Guardar o resultado por produto é o que
   impede a mesma foto de ser recortada de novo toda vez que o painel
   abre — e o `emAndamento` é o que impede dois cliques seguidos virarem
   duas gerações do mesmo produto.

   `emAndamento` NÃO é persistido: um job em andamento não sobrevive a um
   recarregamento de página, e restaurá-lo do disco deixaria o cartão
   girando para sempre sobre um job que ninguém mais está esperando.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Recorte = {
  /** A foto limpa, já em disco (`/generated/...`). */
  url: string;
  /** A foto de origem, para saber se a base trocou a imagem do produto. */
  origem: string;
  modelo: string;
  em: string;
};

interface EstadoProdutos {
  /** Recortes prontos, por pid do produto. */
  recortes: Record<string, Recorte>;
  /** Pids recortando agora. Fora do `persist` — ver o cabeçalho. */
  emAndamento: Record<string, true>;
  /** Pids marcados para entrar na cena. A ordem é a de marcação. */
  selecionados: string[];

  guardarRecorte: (pid: string, recorte: Recorte) => void;
  descartarRecorte: (pid: string) => void;
  marcarAndamento: (pid: string, ligado: boolean) => void;
  alternarSelecao: (pid: string) => void;
  limparSelecao: () => void;
}

export const useProdutosStore = create<EstadoProdutos>()(
  persist(
    (set) => ({
      recortes: {},
      emAndamento: {},
      selecionados: [],

      guardarRecorte: (pid, recorte) =>
        set((e) => ({
          recortes: { ...e.recortes, [pid]: recorte },
          emAndamento: Object.fromEntries(
            Object.entries(e.emAndamento).filter(([k]) => k !== pid),
          ) as Record<string, true>,
        })),

      descartarRecorte: (pid) =>
        set((e) => ({
          recortes: Object.fromEntries(Object.entries(e.recortes).filter(([k]) => k !== pid)),
        })),

      marcarAndamento: (pid, ligado) =>
        set((e) => {
          const proximo = { ...e.emAndamento };
          if (ligado) proximo[pid] = true;
          else delete proximo[pid];
          return { emAndamento: proximo };
        }),

      alternarSelecao: (pid) =>
        set((e) => ({
          selecionados: e.selecionados.includes(pid)
            ? e.selecionados.filter((p) => p !== pid)
            : [...e.selecionados, pid],
        })),

      limparSelecao: () => set({ selecionados: [] }),
    }),
    {
      name: "pitch-produtos",
      partialize: (e) => ({ recortes: e.recortes, selecionados: e.selecionados }),
    },
  ),
);

/**
 * A melhor foto que temos de um produto: a recortada quando existe e
 * ainda corresponde à origem, senão a da base.
 *
 * A comparação com `origem` importa porque a curadoria do PitchAI troca
 * a foto de um produto de vez em quando. Quando isso acontece, o recorte
 * antigo é de outra imagem — e mostrar o produto errado com cara de
 * certo é pior do que mostrar a foto suja.
 */
export function melhorFoto(
  pid: string | null,
  imagemDaBase: string | null,
  recortes: Record<string, Recorte>,
): { url: string | null; limpa: boolean } {
  if (!pid) return { url: imagemDaBase, limpa: false };
  const recorte = recortes[pid];
  if (recorte && recorte.origem === imagemDaBase) return { url: recorte.url, limpa: true };
  return { url: imagemDaBase, limpa: false };
}

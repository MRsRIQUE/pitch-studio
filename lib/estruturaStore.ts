/* ============================================================
   AS SESSÕES DE ESTRUTURAÇÃO

   Estruturar uma ideia não acaba numa sentada: o usuário volta, muda
   uma cena, leva de novo para o Criar. Por isso a sessão é guardada
   inteira — conversa E artefato —, e não só o texto, como no
   `chatSessionStore`. O artefato é o produto; perdê-lo no refresh seria
   perder a tela toda.

   Persistência no padrão do `lib/folderStore.ts`: zustand + `persist`
   com `partialize` explícito. Sem servidor por trás — é local.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Estrutura } from "@/lib/estruturaIdeia";

export type ModoEstrutura = "livre" | "ugc";

export interface MensagemEstrutura {
  id: string;
  papel: "usuario" | "assistente";
  /** Só a prosa: o bloco de estrutura é separado antes de chegar aqui. */
  texto: string;
  /** URLs `/generated/...` que foram junto (as fotos do briefing UGC). Ficam
      no histórico: o modelo precisa vê-las de novo a cada turno. */
  imagens?: string[];
  escrevendo?: boolean;
  erro?: string;
}

export interface SessaoEstrutura {
  id: string;
  titulo: string;
  /** "ugc" = briefing com esboço e aprovação; ausente = ideia livre. */
  modo?: ModoEstrutura;
  mensagens: MensagemEstrutura[];
  /** O artefato mais recente. `null` enquanto a conversa não produziu um. */
  estrutura: Estrutura | null;
  criadaEm: number;
  atualizadaEm: number;
}

interface EstruturaState {
  sessoes: SessaoEstrutura[];
  /** Modelo de conversa escolhido, compartilhado por todas as sessões. */
  modelo: string;

  definirModelo: (modelo: string) => void;
  criarSessao: (titulo: string, modo?: ModoEstrutura) => string;
  renomear: (id: string, titulo: string) => void;
  apagar: (id: string) => void;
  adicionarMensagem: (id: string, m: MensagemEstrutura) => void;
  atualizarMensagem: (id: string, msgId: string, patch: Partial<MensagemEstrutura>) => void;
  definirEstrutura: (id: string, estrutura: Estrutura) => void;
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `est-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Aplica um patch a uma sessão e carimba `atualizadaEm`. */
function naSessao(
  sessoes: SessaoEstrutura[],
  id: string,
  fn: (s: SessaoEstrutura) => SessaoEstrutura,
): SessaoEstrutura[] {
  return sessoes.map(s => (s.id === id ? { ...fn(s), atualizadaEm: Date.now() } : s));
}

export const useEstruturaStore = create<EstruturaState>()(
  persist(
    set => ({
      sessoes: [],
      modelo: "claude-sonnet-4-6",

      definirModelo: modelo => set({ modelo }),

      criarSessao: (titulo, modo) => {
        const id = novoId();
        const agora = Date.now();
        set(s => ({
          sessoes: [
            { id, titulo, ...(modo ? { modo } : {}), mensagens: [], estrutura: null, criadaEm: agora, atualizadaEm: agora },
            ...s.sessoes,
          ],
        }));
        return id;
      },

      renomear: (id, titulo) => set(s => ({ sessoes: naSessao(s.sessoes, id, x => ({ ...x, titulo })) })),

      apagar: id => set(s => ({ sessoes: s.sessoes.filter(x => x.id !== id) })),

      adicionarMensagem: (id, m) =>
        set(s => ({ sessoes: naSessao(s.sessoes, id, x => ({ ...x, mensagens: [...x.mensagens, m] })) })),

      atualizarMensagem: (id, msgId, patch) =>
        set(s => ({
          sessoes: naSessao(s.sessoes, id, x => ({
            ...x,
            mensagens: x.mensagens.map(m => (m.id === msgId ? { ...m, ...patch } : m)),
          })),
        })),

      definirEstrutura: (id, estrutura) =>
        set(s => ({ sessoes: naSessao(s.sessoes, id, x => ({ ...x, estrutura })) })),
    }),
    {
      name: "pitch-estrutura-v1",
      partialize: state => ({ sessoes: state.sessoes, modelo: state.modelo }),
    },
  ),
);

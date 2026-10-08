/* ============================================================
   PERSONAGENS — quem aparece no vídeo

   O Pitch não tinha isso. O que existia era o `character_orientation` do
   Motion Control, que é outra coisa: um parâmetro do modelo dizendo se a
   pose vem de imagem ou de vídeo. Personagem, no sentido de "a pessoa
   que segura o produto e fala dele", não existia em lugar nenhum — e é a
   metade que falta para o UGC ficar de pé.

   Um personagem aqui é: um nome, um punhado de fotos da mesma pessoa e
   uma descrição curta. As fotos são o que vai para o modelo como
   referência; a descrição é o que entra no prompt, porque nenhum modelo
   de vídeo lê "use a Ana" — ele lê "mulher de 30 anos, cabelo castanho
   ondulado, sorriso aberto".

   ── As fotos são DURÁVEIS, não data URLs ────────────────────────────
   O `persist` do zustand grava no `localStorage`, que tem um teto na
   casa dos 5 MB por origem. Três personagens com quatro fotos em base64
   estouram isso e o store inteiro para de salvar — em silêncio, que é o
   pior jeito. Por isso `adicionarFoto` recebe uma URL já gravada em
   disco (`/generated/...`, via `POST /api/upload`) e o store guarda só o
   endereço. Quem chama é quem faz o upload; este arquivo não faz rede.

   Persistência no padrão de `lib/estilosStore.ts`: zustand + `persist`
   com `partialize` explícito.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AvatarSelections } from "./avatarPromptKit";

export interface Personagem {
  id: string;
  nome: string;
  /** URLs duráveis (`/generated/...`). Nunca data URLs — ver o cabeçalho. */
  fotos: string[];
  /** A descrição física que entra no prompt. Pode ficar vazia. */
  descricao: string;
  /** Configuração estruturada usada para remontar o avatar CGI. */
  avatarSelections?: AvatarSelections;
  /** Prompt completo em inglês enviado ao modelo de imagem. */
  avatarPrompt?: string;
  /** Bloco literal reaproveitado com as referências para manter o mesmo rosto. */
  identityLock?: string;
  avatarKitVersion?: string;
  criadoEm: string;
  atualizadoEm: string;
  /** Desligado continua guardado, mas não é oferecido na hora de montar a cena. */
  ativo: boolean;
  /** Quantas vezes o personagem já foi usado numa geração. Contagem real. */
  usos: number;
  geracao?: { taskId: string; iniciadaEm: number };
  erroGeracao?: string;
}

/** Quantas fotos um personagem aceita. O teto vem do modelo, não da tela:
 *  o Nano Banana Pro recebe 8 imagens, e a cena ainda precisa de espaço
 *  para o produto. */
export const MAX_FOTOS = 6;

interface EstadoPersonagens {
  personagens: Personagem[];
  /** O último escolhido — a grade o marca e a montagem o assume. */
  ultimoUsadoId: string | null;

  criar: (nome: string, dados?: Partial<Pick<Personagem, "descricao" | "fotos" | "avatarSelections" | "avatarPrompt" | "identityLock" | "avatarKitVersion">>) => string;
  renomear: (id: string, nome: string) => void;
  definirDescricao: (id: string, descricao: string) => void;
  definirAvatar: (id: string, dados: Pick<Personagem, "descricao" | "avatarSelections" | "avatarPrompt" | "identityLock" | "avatarKitVersion">) => void;
  adicionarFoto: (id: string, url: string) => void;
  removerFoto: (id: string, url: string) => void;
  alternarAtivo: (id: string) => void;
  registrarUso: (id: string) => void;
  remover: (id: string) => void;
  atualizarGeracao: (id: string, geracao?: Personagem["geracao"], erro?: string) => void;
}

const agora = () => new Date().toISOString();

function novoId(): string {
  /* `crypto.randomUUID` existe no navegador moderno e no Node 19+; o
     fallback cobre contexto não seguro, onde ele não é exposto. */
  try {
    return crypto.randomUUID();
  } catch {
    return `pers-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const usePersonagensStore = create<EstadoPersonagens>()(
  persist(
    (set, get) => ({
      personagens: [],
      ultimoUsadoId: null,
      atualizarGeracao: (id, geracao, erroGeracao) => set((e) => ({
        personagens: e.personagens.map((p) => p.id === id ? { ...p, geracao, erroGeracao } : p),
      })),

      criar: (nome, dados) => {
        const id = novoId();
        const instante = agora();
        set((e) => ({
          personagens: [
            {
              id,
              nome: nome.trim() || "Sem nome",
              fotos: (dados?.fotos ?? []).slice(0, MAX_FOTOS),
              descricao: dados?.descricao ?? "",
              avatarSelections: dados?.avatarSelections,
              avatarPrompt: dados?.avatarPrompt,
              identityLock: dados?.identityLock,
              avatarKitVersion: dados?.avatarKitVersion,
              criadoEm: instante,
              atualizadoEm: instante,
              ativo: true,
              usos: 0,
            },
            ...e.personagens,
          ],
        }));
        return id;
      },

      renomear: (id, nome) =>
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id ? { ...p, nome: nome.trim() || p.nome, atualizadoEm: agora() } : p,
          ),
        })),

      definirDescricao: (id, descricao) =>
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id ? { ...p, descricao, atualizadoEm: agora() } : p,
          ),
        })),

      definirAvatar: (id, dados) =>
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id ? { ...p, ...dados, atualizadoEm: agora() } : p,
          ),
        })),

      adicionarFoto: (id, url) => {
        /* Uma data URL aqui é o bug do teto do localStorage acontecendo em
           silêncio três semanas depois. Melhor recusar alto, na hora. */
        if (url.startsWith("data:")) {
          console.error(
            "[personagens] recusei uma data URL. Suba a foto com POST /api/upload e passe a URL devolvida.",
          );
          return;
        }
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id && !p.fotos.includes(url) && p.fotos.length < MAX_FOTOS
              ? { ...p, fotos: [...p.fotos, url], atualizadoEm: agora() }
              : p,
          ),
        }));
      },

      removerFoto: (id, url) =>
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id
              ? { ...p, fotos: p.fotos.filter((f) => f !== url), atualizadoEm: agora() }
              : p,
          ),
        })),

      alternarAtivo: (id) =>
        set((e) => ({
          personagens: e.personagens.map((p) =>
            p.id === id ? { ...p, ativo: !p.ativo, atualizadoEm: agora() } : p,
          ),
        })),

      registrarUso: (id) => {
        if (!get().personagens.some((p) => p.id === id)) return;
        set((e) => ({
          ultimoUsadoId: id,
          personagens: e.personagens.map((p) => (p.id === id ? { ...p, usos: p.usos + 1 } : p)),
        }));
      },

      remover: (id) =>
        set((e) => ({
          personagens: e.personagens.filter((p) => p.id !== id),
          ultimoUsadoId: e.ultimoUsadoId === id ? null : e.ultimoUsadoId,
        })),
    }),
    {
      name: "pitch-personagens",
      partialize: (e) => ({ personagens: e.personagens, ultimoUsadoId: e.ultimoUsadoId }),
    },
  ),
);

/** Os que participam da montagem de cena. */
export function personagensAtivos(lista: Personagem[]): Personagem[] {
  return lista.filter((p) => p.ativo);
}

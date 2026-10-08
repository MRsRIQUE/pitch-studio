"use client";

/* ============================================================
   AS QUATRO ORIGENS

   A referência pendura quatro tipos de memória no núcleo, em
   quatro posições fixas: `workflow` em cima, `user` à esquerda,
   `project_index` à direita, `agent_feedback` embaixo. O mapa de
   afordâncias troca o CONTEÚDO de cada um, não a posição:

     workflow       → Gerações   `/api/gallery`
     user           → Conversas  `lib/chatSessionStore`
     project_index  → Projetos   `lib/store` (spaces)
     agent_feedback → Pastas     `lib/folderStore`

   Cada satélite mostra a contagem real e pendura os itens reais
   como nós-âncora — que é onde a referência pendura as memórias
   salvas. Todo nó navega; nó decorativo não existe nesta tela.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFolderStore } from "@/lib/folderStore";
import { useWorkflowStore } from "@/lib/store";
import { useChatSessionStore } from "@/lib/chatSessionStore";
import { getToken } from "@/lib/galleryUtils";
import { applyFragmentToComposer, remixToComposer } from "@/lib/remixHandoff";
import { useMemoriaAnexos } from "@/lib/memoriaAnexos";

/** A posição na roda é a da referência; o nome é o nosso. */
export type OrigemId = "geracoes" | "conversas" | "projetos" | "pastas";
export type Lado = "top" | "left" | "right" | "bottom";

export interface Ancora {
  id: string;
  rotulo: string;
  /** Segunda linha do cartão: modelo, contagem de nós, de mensagens. */
  detalhe?: string;
  destino: string;
  /** Só as pastas precisam entrar na store antes de navegar. */
  idPasta?: string;
  /** Primeira imagem anexada no cartão de criação, se houver. */
  miniatura?: string;
}

export interface Origem {
  id: OrigemId;
  lado: Lado;
  rotulo: string;
  /** `null` enquanto a contagem ainda não voltou da API. */
  total: number | null;
  destino: string;
  /** Texto do campo do cartão de criação, no papel do `Wn` do chunk. */
  convite: string;
  ancoras: Ancora[];
}

/* A referência mostra TODAS as memórias salvas como âncora. As
   nossas origens podem ter centenas de itens; o contador segue
   real e a roda mostra os três mais recentes, que é o que cabe no
   leque de `spread` sem os cartões se encavalarem. */
const MAX_ANCORAS = 3;

interface Bruto {
  id: string;
  url: string;
  prompt?: string;
  model?: string;
  created_at: string;
}

/** Total de gerações e as mais recentes, medidos em `/api/gallery`. */
function useAcervo() {
  const [estado, setEstado] = useState<{ total: number | null; recentes: Ancora[] }>({
    total: null,
    recentes: [],
  });

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const token = await getToken();
        const cab: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        /* `source=generation` porque o satélite se chama "Gerações":
           sem o filtro a API devolve gerações + envios, e o número
           diria uma coisa enquanto o rótulo diz outra. Imagem e vídeo
           são coleções separadas, então o total é a soma das duas. */
        const [img, vid] = await Promise.all([
          fetch("/api/gallery?type=image&page=0&source=generation", { headers: cab })
            .then(r => (r.ok ? r.json() : null)),
          fetch("/api/gallery?type=video&page=0&source=generation", { headers: cab })
            .then(r => (r.ok ? r.json() : null)),
        ]);
        if (!vivo || (!img && !vid)) return;

        const recentes: Ancora[] = [
          ...((img?.items ?? []) as Bruto[]).map(i => ({ ...i, aba: "images" as const })),
          ...((vid?.items ?? []) as Bruto[]).map(i => ({ ...i, aba: "videos" as const })),
        ]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, MAX_ANCORAS)
          .map(i => ({
            id: i.id,
            rotulo: resumir(i.prompt?.trim() || "Sem prompt"),
            detalhe: i.model ?? undefined,
            destino: `/gallery?tab=${i.aba}`,
          }));

        setEstado({ total: (img?.total ?? 0) + (vid?.total ?? 0), recentes });
      } catch {
        /* offline ou API fora: o total fica em null e o satélite
           mostra "—" em vez de um zero que mentiria. */
      }
    })();

    return () => { vivo = false; };
  }, []);

  return estado;
}

export function useOrigens(): Origem[] {
  const pastas = useFolderStore(s => s.folders);
  const itemFolderMap = useFolderStore(s => s.itemFolderMap);
  const carregarPastas = useFolderStore(s => s.loadFromServer);
  const spaces = useWorkflowStore(s => s.spaces);
  const conversas = useChatSessionStore(s => s.sessions);
  const anexos = useMemoriaAnexos(s => s.porAncora);
  const acervo = useAcervo();

  useEffect(() => { carregarPastas(); }, [carregarPastas]);

  return useMemo(() => {
    // A contagem por pasta sai do mesmo mapa que o Acervo usa, para o
    // número do nó nunca divergir do número da outra tela.
    const contarItens = (idPasta: string) =>
      Object.values(itemFolderMap).filter(ids => ids.includes(idPasta)).length;

    const raizes = pastas
      .filter(f => f.parentId === null)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    /* A chave do anexo é a mesma do nó-âncora no grafo. */
    const anexo = (origem: OrigemId, id: string) => anexos[`${origem}:${id}`]?.[0];

    return [
      {
        id: "geracoes",
        lado: "top",
        rotulo: "Gerações",
        total: acervo.total,
        destino: "/gallery?tab=images",
        convite: "Descreva o que você quer gerar…",
        ancoras: acervo.recentes,
      },
      {
        id: "conversas",
        lado: "left",
        rotulo: "Conversas",
        total: conversas.length,
        destino: "/chat",
        convite: "Sobre o que é a conversa…",
        ancoras: [...conversas]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_ANCORAS)
          .map(c => ({
            id: c.id,
            rotulo: resumir(c.title || "Sem título"),
            detalhe: plural(c.messages.length, "mensagem", "mensagens"),
            destino: `/chat?id=${c.id}`,
            miniatura: anexo("conversas", c.id),
          })),
      },
      {
        id: "projetos",
        lado: "right",
        rotulo: "Projetos",
        total: spaces.length,
        destino: "/workflow",
        convite: "Nome do projeto…",
        ancoras: [...spaces]
          .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
          .slice(0, MAX_ANCORAS)
          .map(s => ({
            id: s.id,
            rotulo: resumir(s.name || "Sem nome"),
            detalhe: plural(s.nodes.length, "nó", "nós"),
            destino: `/workflow/${s.id}`,
            miniatura: anexo("projetos", s.id),
          })),
      },
      {
        id: "pastas",
        lado: "bottom",
        rotulo: "Pastas",
        total: pastas.length,
        destino: "/gallery?tab=images",
        convite: "Nome da pasta…",
        ancoras: raizes.slice(0, MAX_ANCORAS).map(f => ({
          id: f.id,
          rotulo: resumir(f.name),
          detalhe: plural(contarItens(f.id), "item", "itens"),
          destino: `/gallery?tab=images&folder=${f.id}`,
          idPasta: f.id,
          miniatura: anexo("pastas", f.id),
        })),
      },
    ];
  }, [pastas, itemFolderMap, spaces, conversas, acervo, anexos]);
}

/* ============================================================
   CRIAR

   O "+ Add" da referência abre um cartão com um campo de texto e
   salva uma memória. O nosso salva a coisa real de cada origem —
   é a mesma interação ligada ao que existe deste lado.
   ============================================================ */
export function useCriar() {
  const criarPasta = useFolderStore(s => s.createFolder);
  const criarProjeto = useWorkflowStore(s => s.createSpace);
  const criarConversa = useChatSessionStore(s => s.createSession);
  const modeloPreferido = useChatSessionStore(s => s.preferredModel);
  const anexar = useMemoriaAnexos(s => s.anexar);

  /** Devolve a rota para onde ir depois de criar, ou `null` para ficar. */
  return useCallback(
    async (origem: OrigemId, texto: string, imagens: string[] = []): Promise<string | null> => {
      const limpo = texto.trim();
      if (!limpo) return null;

      if (origem === "pastas") {
        const pasta = await criarPasta(limpo);
        anexar(`pastas:${pasta.id}`, imagens);
        return null;   // a pasta nova já aparece como âncora; não tira o usuário daqui
      }
      if (origem === "projetos") {
        criarProjeto(limpo);
        /* `createSpace` não devolve nada, mas deixa o espaço novo como
           ativo — é de lá que sai o id para prender o anexo. */
        const id = useWorkflowStore.getState().activeSpaceId;
        if (id) anexar(`projetos:${id}`, imagens);
        return "/workflow";
      }
      if (origem === "conversas") {
        const id = criarConversa(modeloPreferido, limpo);
        anexar(`conversas:${id}`, imagens);
        return `/chat?id=${id}`;
      }
      /* Gerações: o texto é um prompt, e quem gera é o composer. O
         `remixHandoff` já é a ponte oficial entre outra rota e ele —
         escreve na chave que o composer lê ao montar e devolve o
         destino. Nada de rota nova.

         Com imagem anexada o caminho é o `remixToComposer`, que
         carrega prompt E referências: aqui o anexo não fica preso a
         um registro local porque o registro da âncora ainda não
         existe — ele viaja junto com o texto até o composer, que é
         onde a geração nasce. */
      const destino = imagens.length > 0
        ? remixToComposer({ prompt: limpo, referenceImageUrls: imagens, mediaType: "image" })
        : applyFragmentToComposer(limpo, "images");
      return destino ?? "/gallery?tab=images&view=create";
    },
    [criarPasta, criarProjeto, criarConversa, modeloPreferido, anexar],
  );
}

/* O cartão da referência é `pre-wrap` com `max-width 400`, então um
   prompt inteiro empurraria o leque todo. Cortamos no texto, não na
   caixa, para a geometria do nó continuar a da tabela. */
function resumir(texto: string, limite = 64) {
  const uma = texto.replace(/\s+/g, " ").trim();
  return uma.length > limite ? `${uma.slice(0, limite - 1)}…` : uma;
}

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

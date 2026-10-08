"use client";

/* ============================================================
   A SESSÃO DE PROJETO — a costura entre as três frentes do bloco 09

   O painel de chat, o canvas e o ciclo de geração são três frentes
   diferentes desenhando a MESMA tela. Na leva 2 duas frentes inventaram
   nomes de evento diferentes e nunca se falaram; este arquivo existe
   para que isso não se repita: **é o único contrato entre elas**.

     painel  (Tecla)   escreve as mensagens e o status, lê tudo
     canvas  (Brasa)   lê `artefatos` e escuta `projeto:artefato`
     ciclo   (Cobalto) escuta `projeto:enviado` e escreve o artefato

   Ninguém importa componente de ninguém. Quem precisa de algo do outro
   lê daqui.

   ── Por que o artefato nasce com geometria antes de existir mídia ──
   O INFO.md do bloco 09 insiste nisso, e é a diferença entre a réplica e
   um clone preguiçoso: o placeholder cinza aparece **já no tamanho final
   do artefato**, ao mesmo tempo na miniatura do chat e no canvas, e a
   mídia entra na mesma caixa sem reflow. Por isso `largura` e `altura`
   são obrigatórias em `Artefato` desde o primeiro instante, e `url` é
   que é opcional.
   ============================================================ */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { abrirNoDoArtefato, atualizarNoDoArtefato } from "@/lib/projetoNos";

/* ── Os eventos, com nome único e carga tipada ───────────────── */

export const EVT_ENVIADO = "projeto:enviado";
export const EVT_ARTEFATO = "projeto:artefato";
export const EVT_LOCALIZAR = "projeto:localizar";

export type CargaEnviado = { projetoId: string; mensagemId: string; texto: string };
export type CargaArtefato = { projetoId: string; artefatoId: string };
export type CargaLocalizar = { projetoId: string; artefatoId: string };

function emitir<T>(nome: string, carga: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(nome, { detail: carga }));
}

/** Assina um dos três eventos. Devolve a função que cancela. */
export function assinarProjeto<T>(nome: string, ouvinte: (carga: T) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const alça = (e: Event) => ouvinte((e as CustomEvent<T>).detail);
  window.addEventListener(nome, alça);
  return () => window.removeEventListener(nome, alça);
}

/* ── O modelo ────────────────────────────────────────────────── */

export type TipoArtefato = "imagem" | "video" | "audio" | "3d";
export type EstadoArtefato = "gerando" | "pronto" | "erro";

export type Artefato = {
  id: string;
  tipo: TipoArtefato;
  estado: EstadoArtefato;
  /** A geometria que o backend já informou — existe antes da mídia. */
  largura: number;
  altura: number;
  /** Onde o nó nasce no canvas. A referência usa (862, 190). */
  x: number;
  y: number;
  url?: string;
  modelo?: string;
  /** 0–100 durante o `processing`; o polling é do Cobalto. */
  progresso?: number;
  erro?: string;
  /** De onde ele veio. Um resultado de geração e um arquivo anexado são
      coisas diferentes no `space`: o primeiro é o gerador que o produziu,
      o segundo é um recurso. Ver `lib/projetoNos.ts`. */
  origem?: "geracao" | "anexo";
  /** Falso quando a URL é um `data:` que só vive nesta sessão, porque o
      armazenamento recusou o upload. O `NodeData` faz a mesma distinção
      entre `inputImage` e `r2Url`. */
  duravel?: boolean;
  /** O nó que este artefato é no `space`. Hoje é sempre igual ao `id` —
      fica explícito porque é o elo entre as duas vistas, e um elo
      implícito é o tipo de coisa que quebra em silêncio. */
  noId?: string;
};

/** Uma linha cinza do rastro do agente (`Image Buddy has completed the task`). */
export type LinhaRastro = { icone: TipoArtefato | "modelo"; texto: string };

/* ── O anexo da conversa ──────────────────────────────────────
   Um arquivo que o usuário pôs NO CHAT. Não é artefato: artefato é o
   que já mora no canvas. O anexo vive primeiro na bandeja do composer,
   depois na mensagem que o enviou, e o agente é quem decide se ele
   vira nó — pela ferramenta `usar_anexo` — ou o usuário, pelo botão
   do chip.

   O `rotulo` (`foto 1`, `video 2`) é o nome pelo qual o usuário e o
   modelo se referem a ele: é o que o `@` do composer completa e o que
   o contexto do turno explica ao modelo. Ele é estável pela sessão
   inteira — apagar o `foto 1` não renumera o `foto 2`. */
export type Anexo = {
  id: string;
  tipo: "imagem" | "video";
  /** `foto 1`, `video 1`… sem o `@`. */
  rotulo: string;
  url: string;
  /** Falso quando a URL é um `data:` que só vive nesta sessão. */
  duravel: boolean;
  largura: number;
  altura: number;
  nome?: string;
  /** O nó que este anexo virou no `space`, quando virou. */
  noId?: string;
  em: number;
};

export type Mensagem = {
  id: string;
  papel: "usuario" | "agente";
  texto: string;
  /** Os anexos que foram junto desta mensagem (ids em `referencias`). */
  anexoIds?: string[];
  /** Momento em que entrou — vira a linha de data do thread. */
  em: number;
  /** Ainda chegando por streaming. */
  escrevendo?: boolean;
  /** O bloco `Deep thinking 2.0s`; a duração só aparece quando fecha. */
  pensamento?: { rotulo: string; segundos?: number };
  rastro?: LinhaRastro[];
  artefatoId?: string;
  sugestoes?: string[];
  avaliacao?: "positiva" | "negativa" | null;
};

/** O texto da barra de status, com o shimmer de 3s. Vazio = sem barra. */
export type Status = string;

type SessaoProjeto = {
  tituloProjeto: string;
  tituloSessao: string;
  mensagens: Mensagem[];
  artefatos: Record<string, Artefato>;
  status: Status;
  /** Todo anexo que já passou pelo chat nesta sessão, pelo id. */
  referencias?: Record<string, Anexo>;
  /** Os anexos na bandeja do composer, ainda não enviados (ids). */
  bandeja?: string[];
};

type EstadoProjeto = {
  /** Uma gaveta por projeto: `/projeto/[id]` abre a do id. */
  sessoes: Record<string, SessaoProjeto>;
  painelAberto: boolean;

  ler: (projetoId: string) => SessaoProjeto;
  garantir: (projetoId: string, tituloPadrao: string) => void;

  alternarPainel: () => void;

  renomearProjeto: (projetoId: string, titulo: string) => void;
  renomearSessao: (projetoId: string, titulo: string) => void;
  novaSessao: (projetoId: string) => void;

  /** Põe a mensagem do usuário no thread e avisa quem gera. */
  enviar: (projetoId: string, texto: string, anexoIds?: string[]) => string;

  /* ── A bandeja e as referências ── */
  /** Entra na bandeja já com rótulo (`foto N`). Devolve o anexo. */
  anexar: (projetoId: string, a: Omit<Anexo, "id" | "rotulo" | "em">) => Anexo;
  /** Tira da bandeja. Se nunca foi enviado, some das referências também. */
  desanexar: (projetoId: string, anexoId: string) => void;
  /** Esvazia a bandeja sem apagar as referências (a mensagem já os levou). */
  esvaziarBandeja: (projetoId: string) => void;
  atualizarAnexo: (projetoId: string, anexoId: string, troca: Partial<Anexo>) => void;
  acrescentar: (projetoId: string, m: Omit<Mensagem, "id" | "em"> & { id?: string }) => string;
  atualizarMensagem: (projetoId: string, id: string, troca: Partial<Mensagem>) => void;
  avaliar: (projetoId: string, id: string, voto: "positiva" | "negativa") => void;

  definirStatus: (projetoId: string, texto: Status) => void;

  /** O artefato nasce em `gerando`, já com a caixa final. */
  abrirArtefato: (projetoId: string, a: Artefato) => void;
  atualizarArtefato: (projetoId: string, id: string, troca: Partial<Artefato>) => void;
  localizarNoCanvas: (projetoId: string, artefatoId: string) => void;
};

const SESSAO_VAZIA: SessaoProjeto = {
  tituloProjeto: "Sem título",
  tituloSessao: "Nova conversa",
  mensagens: [],
  artefatos: {},
  status: "",
};

function id(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const useProjetoSessao = create<EstadoProjeto>()(
  persist(
    (set, get) => {
      /* Toda escrita passa por aqui, para nenhuma delas esquecer de
         criar a gaveta do projeto antes de mexer nela. */
      const naSessao = (
        projetoId: string,
        troca: (s: SessaoProjeto) => SessaoProjeto,
      ) =>
        set((e) => ({
          sessoes: {
            ...e.sessoes,
            [projetoId]: troca(e.sessoes[projetoId] ?? SESSAO_VAZIA),
          },
        }));

      return {
        sessoes: {},
        painelAberto: true,

        ler: (projetoId) => get().sessoes[projetoId] ?? SESSAO_VAZIA,

        /* Cria a gaveta e, se ela já existir com o título de espera,
           adota o nome verdadeiro do `space`. A gaveta pode nascer antes
           de o `localStorage` hidratar, e nesse instante o nome ainda não
           existe — sem esta segunda metade, o projeto ficava "Sem título"
           para sempre. */
        garantir: (projetoId, tituloPadrao) =>
          set((e) => {
            const atual = e.sessoes[projetoId];
            if (!atual) {
              return {
                sessoes: {
                  ...e.sessoes,
                  [projetoId]: { ...SESSAO_VAZIA, tituloProjeto: tituloPadrao },
                },
              };
            }
            if (
              atual.tituloProjeto !== SESSAO_VAZIA.tituloProjeto ||
              tituloPadrao === SESSAO_VAZIA.tituloProjeto
            ) {
              return e;
            }
            return {
              sessoes: {
                ...e.sessoes,
                [projetoId]: { ...atual, tituloProjeto: tituloPadrao },
              },
            };
          }),

        alternarPainel: () => set((e) => ({ painelAberto: !e.painelAberto })),

        renomearProjeto: (projetoId, titulo) =>
          naSessao(projetoId, (s) => ({ ...s, tituloProjeto: titulo })),

        renomearSessao: (projetoId, titulo) =>
          naSessao(projetoId, (s) => ({ ...s, tituloSessao: titulo })),

        novaSessao: (projetoId) =>
          naSessao(projetoId, (s) => ({
            ...s,
            tituloSessao: "Nova conversa",
            mensagens: [],
            status: "",
            /* As referências são da conversa: `@foto 1` numa sessão nova
               é outra foto. A bandeja vai junto — o que estava pendente
               pertencia à conversa que acabou. */
            referencias: {},
            bandeja: [],
          })),

        enviar: (projetoId, texto, anexoIds) => {
          const mid = id();
          naSessao(projetoId, (s) => ({
            ...s,
            mensagens: [
              ...s.mensagens,
              {
                id: mid,
                papel: "usuario",
                texto,
                em: Date.now(),
                ...(anexoIds?.length ? { anexoIds } : {}),
              },
            ],
            status: "Pensando…",
          }));
          emitir<CargaEnviado>(EVT_ENVIADO, { projetoId, mensagemId: mid, texto });
          return mid;
        },

        anexar: (projetoId, a) => {
          const atual = get().sessoes[projetoId] ?? SESSAO_VAZIA;
          const referencias = atual.referencias ?? {};
          /* O número é o próximo livre do TIPO, e não da bandeja: `foto 1`
             continua sendo a mesma foto depois de enviada, apagada ou não. */
          const prefixo = a.tipo === "video" ? "video" : "foto";
          const usados = Object.values(referencias)
            .filter((r) => r.tipo === a.tipo)
            .map((r) => Number(r.rotulo.replace(/\D+/g, "")) || 0);
          const numero = (usados.length ? Math.max(...usados) : 0) + 1;
          const anexo: Anexo = { ...a, id: `anexo-${id()}`, rotulo: `${prefixo} ${numero}`, em: Date.now() };
          naSessao(projetoId, (s) => ({
            ...s,
            referencias: { ...(s.referencias ?? {}), [anexo.id]: anexo },
            bandeja: [...(s.bandeja ?? []), anexo.id],
          }));
          return anexo;
        },

        desanexar: (projetoId, anexoId) =>
          naSessao(projetoId, (s) => {
            const enviado = s.mensagens.some((m) => m.anexoIds?.includes(anexoId));
            const referencias = { ...(s.referencias ?? {}) };
            if (!enviado) delete referencias[anexoId];
            return {
              ...s,
              referencias,
              bandeja: (s.bandeja ?? []).filter((x) => x !== anexoId),
            };
          }),

        esvaziarBandeja: (projetoId) =>
          naSessao(projetoId, (s) => ({ ...s, bandeja: [] })),

        atualizarAnexo: (projetoId, anexoId, troca) =>
          naSessao(projetoId, (s) => {
            const atual = s.referencias?.[anexoId];
            if (!atual) return s;
            return {
              ...s,
              referencias: { ...(s.referencias ?? {}), [anexoId]: { ...atual, ...troca } },
            };
          }),

        acrescentar: (projetoId, m) => {
          const mid = m.id ?? id();
          naSessao(projetoId, (s) => ({
            ...s,
            mensagens: [...s.mensagens, { ...m, id: mid, em: Date.now() } as Mensagem],
          }));
          return mid;
        },

        atualizarMensagem: (projetoId, mid, troca) =>
          naSessao(projetoId, (s) => ({
            ...s,
            mensagens: s.mensagens.map((m) => (m.id === mid ? { ...m, ...troca } : m)),
          })),

        avaliar: (projetoId, mid, voto) =>
          naSessao(projetoId, (s) => ({
            ...s,
            mensagens: s.mensagens.map((m) =>
              /* Os dois polegares são exclusivos entre si, e clicar no
                 que já está marcado desmarca. */
              m.id === mid ? { ...m, avaliacao: m.avaliacao === voto ? null : voto } : m,
            ),
          })),

        definirStatus: (projetoId, texto) =>
          naSessao(projetoId, (s) => ({ ...s, status: texto })),

        /* O artefato nasce em DOIS lugares ao mesmo tempo, e é de
           propósito: a ficha dele fica aqui, para a Conversa desenhar a
           miniatura, e o RESULTADO vira nó no `space`, que é onde o
           projeto mora de verdade. Sem a segunda metade, recarregar a
           página apagava o que tinha sido gerado e o Grafo nunca via
           nada — era isso que impedia as duas vistas de serem a mesma
           coisa. */
        abrirArtefato: (projetoId, a) => {
          const no = abrirNoDoArtefato(projetoId, a);
          /* A posição de verdade é a que o `space` escolheu — ele sabe o
             que já está ocupado. Sem isto, dois artefatos seguidos
             nasceriam um em cima do outro na Conversa. */
          const comNo: Artefato = no ? { ...a, noId: no.id, x: no.x, y: no.y } : a;
          naSessao(projetoId, (s) => ({ ...s, artefatos: { ...s.artefatos, [a.id]: comNo } }));
          emitir<CargaArtefato>(EVT_ARTEFATO, { projetoId, artefatoId: a.id });
        },

        atualizarArtefato: (projetoId, aid, troca) => {
          let depois: Artefato | null = null;
          naSessao(projetoId, (s) => {
            const atual = s.artefatos[aid];
            if (!atual) return s;
            depois = { ...atual, ...troca };
            return { ...s, artefatos: { ...s.artefatos, [aid]: depois } };
          });
          /* Quando a geração termina é aqui que a URL chega — e daqui ela
             tem de chegar ao nó, senão o Grafo mostra um nó em curso que
             nunca fecha. */
          if (depois) atualizarNoDoArtefato(projetoId, depois);
          emitir<CargaArtefato>(EVT_ARTEFATO, { projetoId, artefatoId: aid });
        },

        localizarNoCanvas: (projetoId, artefatoId) =>
          emitir<CargaLocalizar>(EVT_LOCALIZAR, { projetoId, artefatoId }),
      };
    },
    {
      name: "pitch-projeto-sessoes",
      storage: createJSONStorage(() => localStorage),
      /* `painelAberto` é da janela, não do projeto: quem colapsou o
         painel numa aba não quer encontrá-lo colapsado em outro dia. */
      partialize: (e) => ({ sessoes: e.sessoes }),
    },
  ),
);

/* ── Rótulos, todos do i18n da referência ────────────────────── */

/** `subagent.buddyName` — a família de subagentes por tipo de mídia. */
export const NOME_AJUDANTE: Record<TipoArtefato, string> = {
  imagem: "Ajudante de Imagem",
  video: "Ajudante de Vídeo",
  audio: "Ajudante de Áudio",
  "3d": "Ajudante 3D",
};

/** `subagent.lifecycle` — o ciclo de vida que vira linha de rastro. */
export function rastroConcluido(tipo: TipoArtefato): string {
  return `${NOME_AJUDANTE[tipo]} concluiu a tarefa`;
}
export function rastroAssumiu(tipo: TipoArtefato): string {
  return `${NOME_AJUDANTE[tipo]} assumiu a tarefa`;
}
export function rastroFalhou(tipo: TipoArtefato): string {
  return `${NOME_AJUDANTE[tipo]} encontrou um problema`;
}

/** `mediaToolProgress.*` — o texto da barra de status durante a geração. */
export const STATUS_GERANDO: Record<TipoArtefato, string> = {
  imagem: "Gerando imagem",
  video: "Gerando vídeo",
  audio: "Gerando áudio",
  "3d": "Gerando 3D",
};

/** `statusBar.*` — os estados fixos da barra. */
export const STATUS = {
  pensando: "Pensando…",
  esperando: "Aguardando…",
  buscando: "Buscando…",
  editando: "Editando…",
  gerando: "Gerando…",
  pronto: "Pronto~",
  erro: "Algo deu errado…",
} as const;

/** `mediaResult.generating` — o rótulo da pílula branca de 85×28. */
export const ROTULO_GERANDO = "Gerando";

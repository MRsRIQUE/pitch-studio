/* ============================================================
   RECEITAS — fluxos curados, prontos para abrir

   A Inspiração mostra as gerações da própria conta: quem acabou de
   chegar não tem nada lá. As receitas são o contrário — material de
   referência que existe antes da primeira geração: um jeito de fazer,
   com os modelos, os passos e um botão que abre a tela ou o template
   certo já montado.

   A primeira é a do @ViralOps_ (X, set/2026): GPT Images para a pessoa,
   Seedance 2.5 para o vídeo, e o prompt de produção com ações por
   segundo. As outras são as partes do Pitch Studio que essa receita
   toca, para o usuário achar cada peça de onde ela sai.

   Os ids de modelo são conferidos contra `lib/modelConfig.ts` pela
   tela, nunca escritos como nome: se um modelo sair do catálogo, o
   card deixa de listá-lo em vez de mostrar um nome morto.
   ============================================================ */

import { makeTrocaPessoaTemplate, makeUGCTemplate, TROCA_PESSOA_TEMPLATE_NAME } from "@/lib/templates";
import { useWorkflowStore } from "@/lib/store";

export type AcaoReceita =
  | { rotulo: string; tipo: "rota"; href: string }
  | { rotulo: string; tipo: "template"; template: "ugc" | "troca-pessoa" };

export interface Receita {
  id: string;
  titulo: string;
  /** Uma ou duas frases: o que sai e por que funciona. */
  resumo: string;
  /** De onde veio, quando não é nossa. */
  credito?: string;
  /** Ids reais de `IMAGE_MODELS` e `VIDEO_MODELS`. */
  modelos: string[];
  passos: string[];
  /** A primeira ação é a principal. */
  acoes: AcaoReceita[];
}

export const RECEITAS: Receita[] = [
  {
    id: "ugc-realista",
    titulo: "UGC realista: pessoa, produto e vídeo falado",
    resumo:
      "Uma pessoa gerada que parece gravada no celular, segurando o seu produto e falando com a câmera. O segredo não é o modelo: é o prompt de produção com ações marcadas por segundo.",
    credito: "Receita de @ViralOps_ no X (set/2026), adaptada ao Pitch Studio",
    modelos: ["nano-banana-pro", "gpt-image-2", "seedance-2-5"],
    passos: [
      "Crie o personagem: descreva a pessoa ou parta de uma foto casual de referência (enquadramento, pose e luz vêm dela; a pessoa é nova).",
      "Abra o briefing UGC no Estruturar: personagem, produto, duração, ideia, hook, script e estilo. O assistente devolve um esboço para você aprovar antes de gastar geração.",
      "Aprove o esboço. Ele vira o prompt de produção: referências com papel, timeline por segundo, uma câmera, áudio e o que fica igual.",
      "Monte no grafo e gere: a cena parada (imagem) é o primeiro quadro do vídeo (Seedance 2.5). Revise rosto, mãos, produto e fala.",
      "Se só um detalhe saiu errado, use Corrigir no nó do vídeo: o prompt ganha um bloco FIX em vez de ser reescrito.",
    ],
    acoes: [
      { rotulo: "Abrir o briefing UGC", tipo: "rota", href: "/estruturar?modo=ugc" },
      { rotulo: "Personagem a partir de foto", tipo: "rota", href: "/personagens?modo=referencia" },
      { rotulo: "Template UGC pronto", tipo: "template", template: "ugc" },
    ],
  },
  {
    id: "trocar-pessoa",
    titulo: "Trocar a pessoa de um vídeo que já existe",
    resumo:
      "Um vídeo de referência dá o movimento, a câmera e a cena. O prompt diz só três coisas: o que muda, qual referência substitui, o que fica igual.",
    credito: "Bônus da receita de @ViralOps_ no X",
    modelos: ["seedance-2-5-edit"],
    passos: [
      "Solte o vídeo de referência no nó de vídeo e a foto do seu personagem em \"Personagem\".",
      "Produto e cenário novos são opcionais: sem foto, apague a linha correspondente do prompt.",
      "Ajuste a fala (instante e texto) e gere. Se a troca não pegou, diga no Corrigir o que ficou do vídeo original.",
    ],
    acoes: [{ rotulo: "Abrir o template", tipo: "template", template: "troca-pessoa" }],
  },
  {
    id: "cena-de-produto",
    titulo: "Cena de produto com o seu personagem",
    resumo:
      "Um produto quente, um personagem do seu elenco, e a cena montada no grafo em um clique: a foto parada primeiro, para você ver se a mão pegou o produto certo antes de gastar o vídeo.",
    modelos: ["nano-banana-pro", "seedance-2-5"],
    passos: [
      "Em Quentes, limpe a foto do produto (recorte) e clique em Usar.",
      "Escolha o personagem. A cena nasce com o prompt de produção já com timeline e fala de exemplo.",
      "Gere a imagem, confira, e só então gere o vídeo.",
    ],
    acoes: [
      { rotulo: "Ir para Quentes", tipo: "rota", href: "/quentes" },
      { rotulo: "Meus personagens", tipo: "rota", href: "/personagens" },
    ],
  },
];

/* ── Executar uma ação ─────────────────────────────────────────
   Mesma sequência do painel de workflows: um template velho com o mesmo
   nome é descartado antes, senão o usuário acumula cópias a cada clique. */

const UGC_TEMPLATE_NAME = "UGC Template";

export function abrirTemplate(qual: "ugc" | "troca-pessoa"): string {
  const nome = qual === "ugc" ? UGC_TEMPLATE_NAME : TROCA_PESSOA_TEMPLATE_NAME;
  const make = qual === "ugc" ? makeUGCTemplate : makeTrocaPessoaTemplate;
  const store = useWorkflowStore.getState();
  const existente = store.spaces.find(sp => sp.name === nome);
  if (existente) {
    if (store.spaces.length === 1) store.createSpace("Space 1");
    store.deleteSpace(existente.id);
  }
  store.createSpace(nome, make());
  return `/workflow/${useWorkflowStore.getState().activeSpaceId}`;
}

/** Devolve a rota para onde a ação leva. Templates são criados aqui mesmo. */
export function destinoDaAcao(acao: AcaoReceita): string {
  return acao.tipo === "rota" ? acao.href : abrirTemplate(acao.template);
}

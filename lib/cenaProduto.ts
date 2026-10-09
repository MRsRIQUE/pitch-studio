/* ============================================================
   MONTAR A CENA — produto + personagem → vídeo

   O pedido era "o usuário seleciona o produto para o personagem dele
   fazer o vídeo". Isso não é um nó: é um fluxo de quatro peças, e a
   ordem importa.

     [foto do produto]  ┐
                        ├→ (gerador de imagem) → (gerador de vídeo)
     [foto da pessoa]   ┘         a cena              a animação

   Por que não ligar as duas fotos direto no gerador de VÍDEO: os
   modelos de vídeo recebem um primeiro quadro, não um elenco. Mandar
   duas referências soltas para um deles dá vídeo com o produto flutuando
   ao lado da pessoa, ou a pessoa segurando outra coisa. Compondo a cena
   parada primeiro, o usuário VÊ se a mão pegou o produto certo antes de
   gastar uma geração de vídeo — que custa muito mais que uma de imagem.

   ── AS FOTOS PRECISAM SER DA NOSSA ORIGEM ───────────────────────────
   `produto.foto` e `personagem.fotos` têm que ser `/generated/...`, não
   a URL do CDN de onde vieram. O `ImageInputNode` desenha com
   `next/image`, que LANÇA quando o host não está no `remotePatterns` do
   `next.config.ts` — e a exceção não fica contida no nó: derruba a
   árvore do React Flow inteira. Medido, com URL de `s.500fd.com`: o
   canvas foi de 10 nós a zero, com "Invalid src prop" no console.

   Quem chama grava as fotos antes (ver `paraDisco` em
   `components/produtos/PainelQuentes.tsx`). O aviso abaixo existe para o
   caso de alguém esquecer.

   ── A escrita é uma só ──────────────────────────────────────────────
   Mesmo padrão de `aplicarChamadas` em `lib/projetoFluxo.ts`: um
   `pushUndoSnapshot()` antes de tudo, depois os nós em lote, as arestas
   em lote e os contadores no fim. É o que faz um Ctrl+Z desfazer a cena
   inteira em vez de tirar um nó por vez.
   ============================================================ */

import type { Edge, Node, NodeChange, EdgeChange } from "@xyflow/react";
import { useWorkflowStore, getNodeLabel, type NodeData } from "@/lib/store";
import { NODE_SIZE, FALLBACK_SIZE } from "@/lib/nodeTypes";
import { edgeStyle } from "@/lib/edgeStyles";
import type { Entrada } from "@/lib/assistantTools";
import { promptProducaoUGC } from "@/lib/ugcPromptKit";

/** Modelos de partida. O usuário troca no nó; isto é só o que já vem posto. */
export const MODELO_CENA = "nano-banana-pro";
export const MODELO_VIDEO = "seedance-2-5";

/** Vertical, que é onde o UGC vive. */
export const PROPORCAO = "9:16";
/** Duração do vídeo da cena. Oito segundos: cabe uma fala curta e a timeline
 *  do prompt de produção cobre tudo sem buraco. */
export const DURACAO_VIDEO = 8;

const VAO_X = 96;
const VAO_Y = 40;

function tamanho(tipo: string): { w: number; h: number } {
  return NODE_SIZE[tipo] ?? FALLBACK_SIZE;
}

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type ProdutoDaCena = {
  nome: string;
  /** A foto que entra no fluxo — a limpa quando existe. */
  foto: string;
  preco?: number;
};

export type PersonagemDaCena = {
  nome: string;
  fotos: string[];
  descricao?: string;
};

/**
 * O prompt da imagem composta. Descreve a pessoa por texto ALÉM de mandar
 * a foto porque o modelo pesa as duas coisas: só a foto costuma trazer a
 * pose e a roupa da referência junto, e é exatamente isso que a gente não
 * quer num UGC — cada peça precisa parecer um take novo.
 */
export function promptDaCena(produto: ProdutoDaCena, personagem: PersonagemDaCena): string {
  const quem = personagem.descricao?.trim()
    ? personagem.descricao.trim()
    : `the person from the reference photos (${personagem.nome})`;

  return [
    `A candid, phone-shot UGC photo: ${quem} holding and showing the product — ${produto.nome}.`,
    "",
    "Keep the person's face, hair and body exactly as in the reference photos.",
    "Keep the product exactly as in its reference: same shape, colours, labels and packaging.",
    "",
    "Natural indoor light, plain everyday background (a room, not a studio), shot as if on a",
    "front-facing phone camera at arm's length. Relaxed, genuine expression. The product is",
    "clearly visible, in focus, held near the chest. Vertical framing.",
    "",
    "No studio lighting, no watermark, no overlaid text, no price tag, no advertising layout.",
  ].join("\n");
}

/**
 * O prompt do vídeo, no molde de produção da receita UGC: referências com
 * papel, timeline por segundo, uma câmera, áudio e o que fica igual. A
 * identidade vem do primeiro quadro (a cena parada), então o bloco de
 * referências fala dele, não de "@" — ver o comentário na montagem.
 * A fala é um exemplo de propósito: é o que o usuário mais reescreve.
 */
export function promptDoVideo(produto: ProdutoDaCena, personagem?: PersonagemDaCena): string {
  return promptProducaoUGC({
    referencia: "primeiroQuadro",
    personagem: rotuloDaPessoa(personagem),
    descricaoPessoa: personagem?.descricao?.trim() || undefined,
    produto: rotuloDoProduto(produto),
    nomeProduto: produto.nome,
    duracao: DURACAO_VIDEO,
    camera: "selfie",
    falas: [
      { em: 1, texto: `Gente, eu testei ${produto.nome} por uma semana...` },
      { em: 5, texto: "e olha o resultado. Sério, vale muito." },
    ],
  });
}

/* Os rótulos dos nós de entrada. Ficam numa função só porque o prompt e a
   montagem precisam do MESMO texto: um "@" que não bate com o rótulo vira
   texto solto no prompt. */
function rotuloDoProduto(produto: ProdutoDaCena): string {
  return produto.nome.slice(0, 40);
}
function rotuloDaPessoa(personagem?: PersonagemDaCena): string {
  return (personagem?.nome ?? "Personagem").slice(0, 40);
}

export type ResultadoCena = {
  nosCriados: number;
  arestasCriadas: number;
  /** Id do gerador de vídeo — quem chama pode focar a tela nele. */
  idDoVideo: string | null;
};

/**
 * Monta a cena no grafo aberto. `origem` é onde o primeiro nó nasce; sem
 * ela, a cena cai à direita do que já existe.
 */
export function montarCenaDeProduto(
  produto: ProdutoDaCena,
  personagem: PersonagemDaCena,
  opcoes: { origem?: { x: number; y: number } } = {},
): ResultadoCena {
  const store = useWorkflowStore.getState();

  /* Um endereço de fora aqui apaga o canvas — ver o cabeçalho. Melhor
     gritar no console de quem programou do que devolver uma tela em
     branco para quem está usando. */
  for (const foto of [produto.foto, ...personagem.fotos]) {
    if (/^https?:/i.test(foto)) {
      console.error(
        `[cena] foto de fora da origem: ${foto} — grave em disco (POST /api/upload) antes de ` +
          "montar a cena, senão o next/image do ImageInputNode lança e leva o canvas junto.",
      );
    }
  }

  /* À direita de tudo o que já existe, para a cena não nascer por cima do
     que o usuário montou antes. */
  const base =
    opcoes.origem ??
    (store.nodes.length === 0
      ? { x: 240, y: 160 }
      : {
          x: Math.max(...store.nodes.map((n) => n.position.x + tamanho(n.type ?? "").w)) + VAO_X,
          y: Math.min(...store.nodes.map((n) => n.position.y)),
        });

  const nos: Node<NodeData>[] = [];
  const arestas: Edge[] = [];
  const contagem: Record<string, number> = {};

  /** Numera continuando de onde o projeto parou, contando os desta leva. */
  const rotular = (tipo: string) => {
    contagem[tipo] = (contagem[tipo] ?? 0) + 1;
    return getNodeLabel(tipo, (store.nodeCounters[tipo] ?? 0) + contagem[tipo]);
  };

  const por = (tipo: string, x: number, y: number, data: Partial<NodeData>) => {
    const { w, h } = tamanho(tipo);
    const id = novoId(tipo);
    nos.push({
      id,
      type: tipo,
      position: { x, y },
      /* Os nós de mídia crescem com a imagem: travar a altura cortaria a
         foto. Mesma regra de `lib/adicionarNo.ts`. */
      style: tipo === "imageInputNode" ? { width: w } : { width: w, height: h },
      data: { label: rotular(tipo), status: "idle", ...data } as NodeData,
    });
    return id;
  };

  const ligar = (de: string, para: string, entrada: Entrada) => {
    arestas.push({
      id: novoId("edge"),
      source: de,
      target: para,
      targetHandle: entrada,
      animated: false,
      style: edgeStyle(entrada),
    });
  };

  const larguraEntrada = tamanho("imageInputNode").w;
  const alturaEntrada = tamanho("imageInputNode").h;

  /* Coluna 1: as entradas. O produto em cima, a pessoa embaixo. */
  const idProduto = por("imageInputNode", base.x, base.y, {
    label: rotuloDoProduto(produto),
    /* As duas chaves apontam para a mesma URL de propósito: `r2Url` é a
       durável que sobrevive ao recarregamento e `inputImage` é a que o nó
       desenha antes de o upload terminar. Aqui a foto JÁ está em disco,
       então as duas são a mesma coisa desde o primeiro quadro. */
    inputImage: produto.foto,
    r2Url: produto.foto,
  });

  const idPessoa = por("imageInputNode", base.x, base.y + alturaEntrada + VAO_Y, {
    label: rotuloDaPessoa(personagem),
    inputImage: personagem.fotos[0],
    r2Url: personagem.fotos[0],
  });

  /* Coluna 2: a cena parada. */
  const idCena = por("generateNode", base.x + larguraEntrada + VAO_X, base.y, {
    prompt: promptDaCena(produto, personagem),
    model: MODELO_CENA,
    aspectRatio: PROPORCAO,
  });

  /* Coluna 3: o vídeo. */
  const idVideo = por(
    "videoGeneratorNode",
    base.x + larguraEntrada + VAO_X + tamanho("generateNode").w + VAO_X,
    base.y,
    {
      prompt: promptDoVideo(produto, personagem),
      videoModel: MODELO_VIDEO,
      aspectRatio: PROPORCAO,
      duration: DURACAO_VIDEO,
    },
  );

  ligar(idProduto, idCena, "image");
  ligar(idPessoa, idCena, "image");
  ligar(idCena, idVideo, "startFrame");
  /* As fotos NÃO entram no vídeo como referência: a rota do Seedance
     descarta `reference_image_urls` quando há primeiro quadro (são
     excludentes na API), e um "@Personagem" resolvido para uma imagem que
     não vai seria uma tag solta no prompt. A identidade viaja pelo
     primeiro quadro, e o prompt diz isso — ver `promptDoVideo`. */

  /* A ÚNICA foto do desfazer, antes de qualquer escrita. */
  store.pushUndoSnapshot();
  store.onNodesChange(nos.map((item) => ({ type: "add", item }) as NodeChange<Node<NodeData>>));
  store.onEdgesChange(arestas.map((item) => ({ type: "add", item }) as EdgeChange));
  store.avancarContadores(contagem);

  return { nosCriados: nos.length, arestasCriadas: arestas.length, idDoVideo: idVideo };
}

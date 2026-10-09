/* ============================================================
   ESTRUTURAR A IDEIA — o esquema, o prompt e as duas entregas

   O `/chat` é pergunta e resposta: acaba em texto. Esta tela acaba em
   ARTEFATO — um roteiro com cenas, cada cena com prompt, modelo e
   proporção reais — e entrega esse artefato ao composer ou ao grafo.

   Como o artefato chega do modelo: num bloco cercado ```estrutura com
   JSON dentro. Não usamos as ferramentas da leva 7 aqui de propósito —
   elas descrevem nós do grafo ("cria um nó no projeto aberto"), e o que
   esta tela precisa é de roteiro, cena e pergunta em aberto. Reaproveitar
   o vocabulário do grafo faria o modelo pensar em nós antes de pensar na
   ideia, que é justamente a inversão que esta tela existe para evitar.

   Em troca de não usar ferramenta, este arquivo faz o trabalho que o
   provedor faria: separa o bloco da prosa, desserializa com tolerância e
   VALIDA campo a campo contra `lib/modelConfig.ts`. Modelo que não existe
   e proporção que aquele modelo não aceita são corrigidos e o conserto
   fica registrado em `ajustes`, para a tela poder dizer o que trocou.
   Nada de id inventado chegando ao composer ou ao grafo.
   ============================================================ */

import type { Node, Edge } from "@xyflow/react";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import type { NodeData } from "@/lib/store";
import { edgeStyle } from "@/lib/edgeStyles";
import { REGRAS_CORRECAO_FOCADA, REGRAS_PROMPT_PRODUCAO_UGC } from "@/lib/ugcPromptKit";

/* ── O artefato ──────────────────────────────────────────── */

export interface Cena {
  titulo: string;
  /** O que acontece na cena, em português, para o usuário ler. */
  descricao: string;
  /** Prompt pronto da imagem — é o texto que vai para o composer. */
  prompt: string;
  /** Prompt do movimento. Vazio quando a cena é só imagem. */
  promptVideo: string;
  /** Id real de `IMAGE_MODELS`. */
  modelo: string;
  /** Id real de `VIDEO_MODELS`, ou vazio. */
  modeloVideo: string;
  proporcao: string;
  /** Segundos. `0` quando o modelo de vídeo não expõe duração. */
  duracao: number;
}

/* ── O briefing UGC ──────────────────────────────────────────
   A receita do @ViralOps_ tem uma etapa que o fluxo livre não tem: antes
   do prompt de produção, o assistente devolve um ESBOÇO (ângulo, hook,
   roteiro, fluxo) e espera aprovação. É barato de ler e caro de pular —
   um prompt de produção de 200 palavras escrito em cima de um ângulo
   errado é uma geração de vídeo jogada fora. */

export interface Esboco {
  /** O ângulo criativo em uma frase: por que alguém para de rolar. */
  angulo: string;
  /** O que acontece nos primeiros 1,5 segundos. Visual, não falado. */
  hook: string;
  /** A fala inteira, em português, do jeito que a pessoa fala. */
  roteiro: string;
  /** O vídeo em 3 a 6 batidas: o que acontece, em ordem. */
  fluxo: string[];
  /** Marcado pela tela quando o usuário aprova. É o que libera as cenas. */
  aprovado: boolean;
}

/** Uma foto que o usuário deu ao briefing e que entra no grafo como nó. */
export interface Referencia {
  papel: "personagem" | "produto" | "cenario";
  /** Rótulo do nó no grafo (e o "@" que o prompt usaria). */
  rotulo: string;
  /** URL durável (`/generated/...`). */
  url: string;
  /** O que o modelo deve saber sobre ela, em uma linha. */
  descricao?: string;
}

export interface Estrutura {
  titulo: string;
  /** Uma linha: peça, formato, duração total. */
  formato: string;
  publico: string;
  /** O roteiro corrido — narração ou copy. */
  roteiro: string;
  cenas: Cena[];
  /** O que ainda falta decidir. É o que mantém a conversa honesta. */
  perguntas: string[];
  /** O que a validação corrigiu. Vazio quando o modelo acertou tudo. */
  ajustes: string[];
  /** Só no briefing UGC: o esboço que precede as cenas. */
  esboco?: Esboco | null;
  /** Só no briefing UGC: as fotos do briefing, que viram nós de entrada. */
  referencias?: Referencia[];
}

export const ESTRUTURA_VAZIA: Estrutura = {
  titulo: "",
  formato: "",
  publico: "",
  roteiro: "",
  cenas: [],
  perguntas: [],
  ajustes: [],
};

export function estruturaTemConteudo(e: Estrutura | null): e is Estrutura {
  if (!e) return false;
  return Boolean(e.titulo || e.roteiro || e.cenas.length || e.esboco?.roteiro);
}

/* ── O prompt de sistema ─────────────────────────────────────
   A lista de modelos é injetada a cada pedido em vez de escrita aqui:
   `lib/modelConfig.ts` é a fonte, e uma cópia envelheceria calada. */

function catalogo(): string {
  const img = IMAGE_MODELS.map(m => `- ${m.id} (${m.name}, ${m.provider}) — proporções: ${m.ratios.join(", ")}`);
  const vid = VIDEO_MODELS.map(m => {
    const dur = m.durations.length ? `durações: ${m.durations.join(", ")}s` : "sem duração ajustável";
    return `- ${m.id} (${m.name}, ${m.provider}) — proporções: ${m.ratios.join(", ")}; ${dur}`;
  });
  return `MODELOS DE IMAGEM\n${img.join("\n")}\n\nMODELOS DE VÍDEO\n${vid.join("\n")}`;
}

export function promptDeSistema(): string {
  return `Você ajuda a ESTRUTURAR uma ideia audiovisual antes de qualquer geração.

Não gere nada e não prometa gerar. O seu produto é o plano: um roteiro dividido em cenas,
cada cena com um prompt pronto, um modelo e uma proporção. Quem gera é o usuário, depois,
levando este plano para o Criar ou para o grafo.

COMO CONDUZIR
- Fale em português, com acentuação completa.
- Se o pedido estiver raso, faça no máximo três perguntas objetivas por vez — e mesmo assim
  já devolva a melhor estrutura possível com o que tem. Nunca devolva um turno só de perguntas.
- Cada resposta sua tem duas partes: uma prosa curta (o que você mudou e por quê) e, no fim,
  o bloco de estrutura COMPLETO. O bloco é sempre inteiro, nunca um pedaço: a tela ao lado é
  substituída por ele a cada turno.
- Prompt de cena é escrito para um gerador de imagem: sujeito, ação, enquadramento, luz,
  lente, textura. Sem "por favor", sem meta-instrução.

REGRAS DURAS
- Use SOMENTE ids de modelo da lista abaixo, exatamente como escritos.
- Use SOMENTE uma proporção que o modelo escolhido aceite.
- Não escreva preço, crédito ou tempo de fila: esses números não existem aqui.
- \`promptVideo\`, \`modeloVideo\` e \`duracao\` só quando a cena tiver movimento; caso
  contrário, string vazia e 0.

${catalogo()}

FORMATO DO BLOCO — sempre no fim da resposta, exatamente assim:

\`\`\`estrutura
{
  "titulo": "",
  "formato": "",
  "publico": "",
  "roteiro": "",
  "cenas": [
    { "titulo": "", "descricao": "", "prompt": "", "promptVideo": "",
      "modelo": "", "modeloVideo": "", "proporcao": "", "duracao": 0 }
  ],
  "perguntas": []
}
\`\`\``;
}

/* ── O prompt de sistema do briefing UGC ─────────────────────
   Mesmo bloco ```estrutura, com dois campos a mais (`esboco`) e uma regra
   de duas fases: sem aprovação, só o esboço; com aprovação, as cenas. A
   fase é lida do `esboco.aprovado` que a tela injeta no contexto — o
   modelo não decide sozinho que foi aprovado. */

export function promptDeSistemaUGC(): string {
  return `Você é o diretor de conteúdo UGC do Pitch Studio. O usuário preencheu um briefing (personagem, produto, duração, ideia, hook, roteiro, local, estilo) e você o transforma em um vídeo UGC que parece gravado no celular — em DUAS FASES.

Não gere nada e não prometa gerar. Quem gera é o usuário, depois, no grafo.

COMO CONDUZIR
- Fale em português, com acentuação completa. Prosa curta: o que você decidiu e por quê, em 3 a 6 linhas.
- Leia TUDO o que o briefing já deu (inclusive as fotos anexadas: descreva para si a pessoa e o produto) e só pergunte o que falta de verdade. Nunca devolva um turno só de perguntas.
- Cada resposta tem duas partes: a prosa e, no fim, o bloco de estrutura COMPLETO (sempre inteiro; a tela ao lado é substituída por ele).

FASE 1 — O ESBOÇO (quando \`esboco.aprovado\` é false ou não existe)
- Devolva \`esboco\` preenchido: \`angulo\` (por que alguém para de rolar, uma frase), \`hook\` (o que acontece nos primeiros 1,5 s — visual, nunca falado), \`roteiro\` (a fala inteira em português do Brasil, do jeito que uma pessoa fala, 5 a 12 palavras por frase, sem jargão de anúncio; cabe na duração pedida a ~2,5 palavras por segundo) e \`fluxo\` (3 a 6 batidas, em ordem).
- \`cenas\` fica VAZIO nesta fase. Termine a prosa perguntando se aprova ou o que quer mudar (hook diferente, roteiro reescrito, outro ângulo, ritmo mais lento).
- Se o usuário pedir ajuste, devolva o esboço inteiro ajustado, ainda com \`cenas\` vazio.

FASE 2 — AS CENAS (quando \`esboco.aprovado\` é true)
- Mantenha o \`esboco\` como está e devolva as \`cenas\`. Para um vídeo UGC de até 15 s, UMA cena basta: a cena parada (imagem) é o primeiro quadro do vídeo. Acima de 15 s, divida em 2 ou 3 cenas encadeadas, cada uma com a sua parte do roteiro, e a última termina no fechamento.
- \`prompt\` (a imagem, o primeiro quadro), em INGLÊS, 60 a 120 palavras: a pessoa do briefing segurando o produto, enquadramento de celular (front camera at arm's length ou phone on a tripod), ambiente do briefing, luz natural, "keep the person's face, hair and body exactly as in the reference photos" e "keep the product exactly as in its reference: same shape, colours, labels and packaging". Vertical. Sem texto na tela.
- \`promptVideo\` é o PROMPT DE PRODUÇÃO. A identidade vem do primeiro quadro (a cena parada), então no bloco REFERENCES escreva "The first frame shows the creator (...) and the product (...): keep both exactly as they appear" em vez de "@rótulos". Regras:

${REGRAS_PROMPT_PRODUCAO_UGC}

${REGRAS_CORRECAO_FOCADA}

- \`modelo\`: use nano-banana-pro para a cena parada. \`modeloVideo\`: use seedance-2-5. \`proporcao\`: 9:16. \`duracao\`: a duração da cena, em segundos, dentro do que o modelo aceita.

REGRAS DURAS
- Use SOMENTE ids de modelo da lista abaixo, exatamente como escritos.
- Use SOMENTE uma proporção que o modelo escolhido aceite.
- Não escreva preço, crédito ou tempo de fila: esses números não existem aqui.
- Nunca ponha texto, legenda ou logo na tela: os modelos erram isso.

${catalogo()}

FORMATO DO BLOCO — sempre no fim da resposta, exatamente assim:

\`\`\`estrutura
{
  "titulo": "",
  "formato": "",
  "publico": "",
  "roteiro": "",
  "esboco": { "angulo": "", "hook": "", "roteiro": "", "fluxo": [], "aprovado": false },
  "cenas": [
    { "titulo": "", "descricao": "", "prompt": "", "promptVideo": "",
      "modelo": "", "modeloVideo": "", "proporcao": "", "duracao": 0 }
  ],
  "perguntas": []
}
\`\`\``;
}

/* ── Separar a prosa do bloco ────────────────────────────────
   Roda a cada pedaço do fluxo, então precisa aguentar o bloco pela
   metade: enquanto a cerca não fechou, o que veio depois dela some da
   prosa em vez de aparecer como JSON cru na conversa. */

const CERCA = /```(?:estrutura|json)?\s*([\s\S]*?)```/gi;

export function separarTexto(bruto: string): { visivel: string; blocos: string[] } {
  const blocos: string[] = [];
  let visivel = bruto.replace(CERCA, (_todo, dentro: string) => {
    blocos.push(dentro);
    return "";
  });
  /* Cerca aberta e ainda não fechada: corta dali para a frente. */
  const aberta = visivel.search(/```(?:estrutura|json)?/i);
  if (aberta >= 0) visivel = visivel.slice(0, aberta);
  return { visivel: visivel.trim(), blocos };
}

/* ── Desserializar e validar ─────────────────────────────────── */

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function numero(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function listaDeTexto(v: unknown): string[] {
  return Array.isArray(v) ? v.map(texto).filter(Boolean) : [];
}

/**
 * Devolve a estrutura validada, ou `null` se nenhum bloco desserializou.
 * A validação corrige em vez de recusar — um plano com o modelo errado
 * ainda é um plano útil; o que não pode é o id errado sair daqui.
 */
export function lerEstrutura(blocos: string[], base?: Estrutura | null): Estrutura | null {
  for (let i = blocos.length - 1; i >= 0; i--) {
    let cru: unknown;
    try { cru = JSON.parse(blocos[i]); } catch { continue; }
    if (!cru || typeof cru !== "object") continue;
    return validar(cru as Record<string, unknown>, base ?? null);
  }
  return null;
}

/* O esboço vem do modelo; o `aprovado` NÃO — ele é decisão do usuário e
   fica com o valor que a tela já tinha. Sem isso, um modelo que devolvesse
   `"aprovado": true` por conta própria pularia a etapa que existe para
   ele não pular. */
function lerEsboco(v: unknown, anterior: Esboco | null | undefined): Esboco | null {
  if (!v || typeof v !== "object") return anterior ?? null;
  const e = v as Record<string, unknown>;
  const esboco: Esboco = {
    angulo: texto(e.angulo),
    hook: texto(e.hook),
    roteiro: texto(e.roteiro),
    fluxo: listaDeTexto(e.fluxo),
    aprovado: anterior?.aprovado ?? false,
  };
  if (!esboco.angulo && !esboco.hook && !esboco.roteiro && esboco.fluxo.length === 0) return anterior ?? null;
  return esboco;
}

function validar(cru: Record<string, unknown>, base: Estrutura | null): Estrutura {
  const ajustes: string[] = [];
  const cenasCruas = Array.isArray(cru.cenas) ? cru.cenas : [];

  const cenas: Cena[] = cenasCruas.map((item, i) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const nome = texto(c.titulo) || `Cena ${i + 1}`;

    /* Modelo de imagem: id inexistente vira o primeiro do catálogo, e o
       conserto é dito em voz alta. O padrão nunca é escolhido em silêncio. */
    const pedidoImg = texto(c.modelo);
    let modelo = IMAGE_MODELS.find(m => m.id === pedidoImg)?.id ?? "";
    if (!modelo) {
      modelo = IMAGE_MODELS[0].id;
      if (pedidoImg) ajustes.push(`${nome}: modelo de imagem "${pedidoImg}" não existe; usei ${modelo}.`);
    }
    const mImg = IMAGE_MODELS.find(m => m.id === modelo)!;

    const pedidoVid = texto(c.modeloVideo);
    let modeloVideo = VIDEO_MODELS.find(m => m.id === pedidoVid)?.id ?? "";
    if (pedidoVid && !modeloVideo) {
      modeloVideo = VIDEO_MODELS[0].id;
      ajustes.push(`${nome}: modelo de vídeo "${pedidoVid}" não existe; usei ${modeloVideo}.`);
    }
    const mVid = modeloVideo ? VIDEO_MODELS.find(m => m.id === modeloVideo)! : null;

    /* A proporção é conferida contra o modelo que ficou, não contra o
       que foi pedido — trocar o modelo pode invalidar a proporção. */
    const aceitas = mVid ? mVid.ratios : mImg.ratios;
    const pedidaProp = texto(c.proporcao);
    let proporcao = aceitas.find(r => r.toLowerCase() === pedidaProp.toLowerCase()) ?? "";
    if (!proporcao) {
      proporcao = mVid?.defaultRatio ?? aceitas[0] ?? "";
      if (pedidaProp) ajustes.push(`${nome}: ${mVid?.name ?? mImg.name} não aceita ${pedidaProp}; usei ${proporcao}.`);
    }

    /* Duração tem três casos, e o terceiro é o que quase passou batido:
       `durations: []` não quer dizer "qualquer duração", quer dizer que o
       modelo NÃO expõe duração (é o caso do Veo). Sem esta primeira
       cláusula, um "42s" proposto pelo modelo sobrevivia até o nó. */
    let duracao = mVid ? numero(c.duracao) : 0;
    if (mVid && mVid.durations.length === 0) {
      if (duracao > 0 && duracao !== mVid.defaultDuration) {
        ajustes.push(`${nome}: ${mVid.name} não tem duração ajustável; tirei os ${duracao}s.`);
      }
      duracao = mVid.defaultDuration;
    } else if (mVid) {
      if (duracao > 0 && !mVid.durations.includes(duracao)) {
        const perto = mVid.durations.reduce((a, b) => (Math.abs(b - duracao) < Math.abs(a - duracao) ? b : a));
        ajustes.push(`${nome}: ${mVid.name} não faz ${duracao}s; usei ${perto}s.`);
        duracao = perto;
      }
      if (duracao === 0) duracao = mVid.defaultDuration;
    }

    return {
      titulo: nome,
      descricao: texto(c.descricao),
      prompt: texto(c.prompt),
      promptVideo: modeloVideo ? texto(c.promptVideo) : "",
      modelo,
      modeloVideo,
      proporcao,
      duracao,
    };
  });

  const esboco = lerEsboco(cru.esboco, base?.esboco);
  /* Um modelo que devolve cenas antes da aprovação pulou a fase 1. As
     cenas não são jogadas fora — seria perder trabalho —, mas o conserto
     fica dito. */
  if (esboco && !esboco.aprovado && cenas.length > 0) {
    ajustes.push("As cenas vieram antes de o esboço ser aprovado; aprove o esboço para o fluxo ficar em dia.");
  }

  return {
    titulo: texto(cru.titulo),
    formato: texto(cru.formato),
    publico: texto(cru.publico),
    roteiro: texto(cru.roteiro),
    cenas,
    perguntas: listaDeTexto(cru.perguntas),
    ajustes,
    ...(esboco ? { esboco } : base?.esboco !== undefined ? { esboco: base.esboco } : {}),
    /* As referências nunca vêm do modelo: são as fotos do briefing. */
    ...(base?.referencias?.length ? { referencias: base.referencias } : {}),
  };
}

/* ── Entrega 2: o grafo ──────────────────────────────────────
   Monta o mesmo desenho de `lib/templates.ts`: para cada cena, um
   promptNode alimentando um generateNode; havendo movimento, o
   generateNode vira quadro inicial de um videoGeneratorNode com o seu
   próprio promptNode. Tudo nasce `idle` — montar não gera, que é a
   mesma regra da leva 7. */

const PASSO_X = 380;
const COLUNA_VIDEO_Y = 0;
const COLUNA_IMAGEM_Y = 620;

export interface Molde {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeCounters: Record<string, number>;
}

export function moldeDoGrafo(e: Estrutura): Molde {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  let nPrompt = 0;
  let nImagem = 0;
  let nVideo = 0;

  /* As fotos do briefing viram nós de entrada numa coluna à esquerda, e
     cada uma alimenta a entrada "image" de TODOS os geradores de imagem:
     é assim que a pessoa e o produto chegam iguais em cada cena. O vídeo
     recebe a cena parada como primeiro quadro — a identidade viaja por
     ele, e a rota do Seedance descarta referências quando há primeiro
     quadro (são excludentes), então ligar as fotos ao vídeo seria inútil. */
  const referencias = e.referencias ?? [];
  referencias.forEach((ref, i) => {
    nodes.push({
      id: `est-ref-${i + 1}`,
      type: "imageInputNode",
      position: { x: -380, y: COLUNA_IMAGEM_Y + i * 240 },
      style: { width: 200 },
      data: { label: ref.rotulo.slice(0, 40), status: "idle", inputImage: ref.url, r2Url: ref.url },
    });
  });

  e.cenas.forEach((cena, i) => {
    const x = i * PASSO_X;
    const temVideo = Boolean(cena.modeloVideo);

    const idPromptImg = `est-pt-${i + 1}`;
    const idImagem = `est-ig-${i + 1}`;
    nPrompt += 1;
    nImagem += 1;

    nodes.push({
      id: idPromptImg,
      type: "promptNode",
      position: { x, y: temVideo ? COLUNA_IMAGEM_Y + 580 : COLUNA_IMAGEM_Y + 300 },
      style: { width: 260, height: 390 },
      data: { label: `Text #${nPrompt}`, status: "idle", prompt: cena.prompt },
    });

    nodes.push({
      id: idImagem,
      type: "generateNode",
      position: { x, y: COLUNA_IMAGEM_Y },
      style: { width: 280, height: 280 },
      data: {
        label: `Image Generator #${nImagem}`,
        status: "idle",
        model: cena.modelo,
        aspectRatio: cena.proporcao,
      },
    });

    edges.push({
      id: `est-e-pt${i + 1}-ig${i + 1}`,
      source: idPromptImg,
      target: idImagem,
      targetHandle: "prompt",
      animated: false,
      style: edgeStyle("prompt"),
    });

    referencias.forEach((_, r) => {
      edges.push({
        id: `est-e-ref${r + 1}-ig${i + 1}`,
        source: `est-ref-${r + 1}`,
        target: idImagem,
        targetHandle: "image",
        animated: false,
        style: edgeStyle("image"),
      });
    });

    if (!temVideo) return;

    const idPromptVid = `est-pv-${i + 1}`;
    const idVideo = `est-vg-${i + 1}`;
    nPrompt += 1;
    nVideo += 1;

    nodes.push({
      id: idPromptVid,
      type: "promptNode",
      position: { x, y: COLUNA_VIDEO_Y - 430 },
      style: { width: 260, height: 390 },
      data: { label: `Text #${nPrompt}`, status: "idle", prompt: cena.promptVideo },
    });

    nodes.push({
      id: idVideo,
      type: "videoGeneratorNode",
      position: { x, y: COLUNA_VIDEO_Y },
      style: { width: 320, height: 220 },
      data: {
        label: `Video Generator #${nVideo}`,
        status: "idle",
        videoModel: cena.modeloVideo,
        aspectRatio: cena.proporcao,
        ...(cena.duracao > 0 ? { duration: cena.duracao } : {}),
      },
    });

    edges.push({
      id: `est-e-ig${i + 1}-vg${i + 1}`,
      source: idImagem,
      target: idVideo,
      targetHandle: "startFrame",
      animated: false,
      style: edgeStyle("startFrame"),
    });
    edges.push({
      id: `est-e-pv${i + 1}-vg${i + 1}`,
      source: idPromptVid,
      target: idVideo,
      targetHandle: "prompt",
      animated: false,
      style: edgeStyle("prompt"),
    });
  });

  return {
    nodes,
    edges,
    nodeCounters: {
      promptNode: nPrompt,
      generateNode: nImagem,
      videoGeneratorNode: nVideo,
      ...(referencias.length ? { imageInputNode: referencias.length } : {}),
    },
  };
}

"use client";

/* ============================================================
   O QUE A IA PEDIU, APLICADO NO GRAFO

   Recebe as chamadas de ferramenta de um turno e as escreve no `space`
   aberto. Duas regras governam este arquivo inteiro:

   ── 1. UM passo de desfazer para a leva toda ──

   `addNode` e `insertEdge` empilham um snapshot CADA. Doze nós e doze
   arestas dariam vinte e quatro `Ctrl+Z` para desfazer um pedido de uma
   frase — o que na prática é não ter desfazer.

   Então a escrita não passa por elas. Passa por `pushUndoSnapshot()`
   UMA vez e depois por `onNodesChange` / `onEdgesChange`, que aplicam
   em lote e **não** empilham nada. Um `undo` volta o grafo inteiro ao
   que era antes do pedido.

   O que `addNode` faz e o lote não fazia era manter `nodeCounters` em
   dia — e sem isso um nó criado à mão depois repetiria um número de
   rótulo. O store ganhou `avancarContadores()`, que soma por tipo,
   sincroniza o `space` e **não** empilha snapshot; ela é chamada uma vez
   no fim da leva, dentro do mesmo bloco. O preço deixou de existir.

   ── 2. Nada aqui gera mídia ──

   A IA monta; quem decide executar é a pílula de modo de execução. Não
   existe função de gerar neste arquivo, de propósito.
   ============================================================ */

import type { Edge, Node, NodeChange, EdgeChange } from "@xyflow/react";
import { useWorkflowStore, getNodeLabel, type NodeData } from "@/lib/store";
import { NODE_SIZE, FALLBACK_SIZE } from "@/lib/nodeTypes";
import { edgeStyle } from "@/lib/edgeStyles";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/modelConfig";
import { TIPOS_PARA_IA, ENTRADAS, type Entrada, type TipoParaIA } from "@/lib/assistantTools";
import type { Anexo } from "@/lib/projetoSessao";

/* ── O que chega do modelo ────────────────────────────────── */

/** O que a leva precisa saber além do grafo: os anexos da conversa,
    para `usar_anexo` e para as `referencias` do fluxo montado. */
export type ContextoDaLeva = {
  anexos: Anexo[];
};

export type ChamadaFerramenta = {
  /** O id que o provedor deu à chamada; volta no resultado. */
  id: string;
  nome: string;
  argumentos: Record<string, unknown>;
};

export type ResultadoFerramenta = {
  id: string;
  nome: string;
  /** O que volta para o modelo no próximo turno. */
  saida: string;
  erro?: boolean;
};

/** O resumo da leva, para a narração e para o cartão de confirmação. */
export type ResumoDaLeva = {
  nosCriados: number;
  arestasCriadas: number;
  nosAlterados: number;
  falhas: string[];
  /** Os anexos que viraram nó nesta leva — quem chamou grava o `noId`. */
  anexosUsados: { anexoId: string; noId: string }[];
};

/* ── Leitura: o grafo como contexto ───────────────────────── */

function texto(d: NodeData | undefined): string {
  const t = (d?.prompt as string | undefined) ?? (d?.comment as string | undefined) ?? "";
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

/**
 * O grafo aberto, em texto, para ir junto do prompt.
 *
 * É metade do valor do pedido: sem isto o assistente propõe o que já
 * existe. Vai compacto de propósito — uma linha por nó e uma por aresta,
 * com id, tipo, modelo e o começo do prompt. Nada de posições nem de
 * URLs: elas ocupariam o contexto sem mudar nenhuma decisão dele.
 */
export function grafoComoTexto(): string {
  const { nodes, edges, spaces, activeSpaceId } = useWorkflowStore.getState();
  const espaco = spaces.find((s) => s.id === activeSpaceId);

  if (nodes.length === 0) {
    return `Projeto aberto: "${espaco?.name ?? "sem nome"}" (id ${activeSpaceId}).\nO grafo está vazio.`;
  }

  const linhasNos = nodes.map((n) => {
    const d = n.data;
    const partes = [`${n.id} [${n.type}]`];
    const modelo = (d?.model as string) ?? (d?.videoModel as string);
    if (modelo) partes.push(`modelo=${modelo}`);
    if (d?.aspectRatio) partes.push(`proporção=${d.aspectRatio as string}`);
    if (d?.status && d.status !== "idle") partes.push(`estado=${d.status as string}`);
    const t = texto(d);
    if (t) partes.push(`texto="${t}"`);
    return `  - ${partes.join(" · ")}`;
  });

  const linhasArestas = edges.map(
    (e) => `  - ${e.source} → ${e.target}${e.targetHandle ? ` (${e.targetHandle})` : ""}`,
  );

  return [
    `Projeto aberto: "${espaco?.name ?? "sem nome"}" (id ${activeSpaceId}).`,
    `Nós (${nodes.length}):`,
    ...linhasNos,
    `Ligações (${edges.length}):`,
    ...(linhasArestas.length ? linhasArestas : ["  (nenhuma)"]),
  ].join("\n");
}

/**
 * Os modelos que existem de verdade, para a IA não inventar id — e o
 * que cada um aceita, para ela escolher certo. Um gerador de imagem que
 * não recebe referência não serve para "preservar o produto da foto"; um
 * de vídeo sem `startFrame` não serve para animar a imagem gerada. Sem
 * estas colunas o agente ligava entradas que o nó não tem.
 */
export function modelosComoTexto(): string {
  const img = IMAGE_MODELS.map((m) => {
    const ref = m.supportsImages ? `referência: até ${m.maxImages} imagem(ns)` : "sem referência";
    return `  - ${m.id} (${m.name}) · ${ref} · proporções: ${m.ratios.join("/")}`;
  });
  const vid = VIDEO_MODELS.map((m) => {
    const entradas = m.handles.filter((h) => h !== "prompt").join(", ") || "só prompt";
    const dur = m.durations.length ? ` · durações: ${m.durations.join("/")}s` : "";
    return `  - ${m.id} (${m.name}) · entradas: ${entradas}${m.sound ? " · áudio" : ""}${dur} · proporções: ${m.ratios.join("/")}`;
  });
  return [
    "Modelos de imagem (id (nome) · o que aceita):",
    ...img,
    "Modelos de vídeo (id (nome) · entradas além do prompt):",
    ...vid,
  ].join("\n");
}

/**
 * Os anexos da conversa, em texto, para o modelo saber o que "@foto 1"
 * é e se já está no grafo. As imagens em si vão como visão na mensagem
 * que as carregou; esta lista é o índice.
 */
export function anexosComoTexto(anexos: Anexo[]): string {
  if (anexos.length === 0) return "Anexos do usuário nesta conversa: nenhum.";
  const linhas = anexos.map((a) => {
    const partes = [`@${a.rotulo}`, a.tipo, `${a.largura}×${a.altura}`];
    if (a.nome) partes.push(`arquivo "${a.nome}"`);
    partes.push(a.noId ? `já no grafo como nó ${a.noId}` : "ainda não está no grafo");
    return `  - ${partes.join(" · ")}`;
  });
  return [
    "Anexos do usuário nesta conversa (use o rótulo em usar_anexo e em referencias):",
    ...linhas,
  ].join("\n");
}

/* ── Escrita ──────────────────────────────────────────────── */

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function tamanho(tipo: string): { w: number; h: number } {
  return NODE_SIZE[tipo] ?? FALLBACK_SIZE;
}

/** O nome do modelo vai no campo que o tipo de nó lê. */
function campoDoModelo(tipo: string): "model" | "videoModel" {
  return tipo === "videoGeneratorNode" ? "videoModel" : "model";
}

function modeloValido(tipo: string, id: unknown): string | null {
  if (typeof id !== "string" || !id) return null;
  const lista = tipo === "videoGeneratorNode" ? VIDEO_MODELS : IMAGE_MODELS;
  return lista.some((m) => m.id === id) ? id : null;
}

/**
 * Um lugar livre para uma caixa nova. Varre para a direita a partir do
 * canto de tudo o que já existe, e desce quando a faixa acaba — o
 * bastante para o que a IA cria não nascer em cima do que já estava.
 */
function posicaoLivre(
  ocupados: { x: number; y: number; w: number; h: number }[],
  w: number,
  h: number,
): { x: number; y: number } {
  const VAO = 60;
  const origem = ocupados.length
    ? { x: Math.min(...ocupados.map((o) => o.x)), y: Math.max(...ocupados.map((o) => o.y + o.h)) + VAO }
    : { x: 0, y: 0 };

  for (let linha = 0; linha < 40; linha++) {
    for (let coluna = 0; coluna < 6; coluna++) {
      const alvo = { x: origem.x + coluna * (w + VAO), y: origem.y + linha * (h + VAO), w, h };
      const bate = ocupados.some(
        (o) => alvo.x < o.x + o.w && alvo.x + alvo.w > o.x && alvo.y < o.y + o.h && alvo.y + alvo.h > o.y,
      );
      if (!bate) return { x: alvo.x, y: alvo.y };
    }
  }
  return origem;
}

/* O acumulador da leva. Nós e arestas são juntados aqui e escritos de
   uma vez só no fim, para o `pushUndoSnapshot` cobrir tudo. */
type Leva = {
  novosNos: Node<NodeData>[];
  novasArestas: Edge[];
  alteracoes: { id: string; data: Partial<NodeData> }[];
  falhas: string[];
  anexosUsados: { anexoId: string; noId: string }[];
  /** Os apelidos (`ref`) que o modelo deu aos nós desta leva → id real.
      É o que deixa criar e ligar no MESMO turno, sem esperar ids. */
  apelidos: Record<string, string>;
};

type Ocupado = { x: number; y: number; w: number; h: number };

function registrarApelido(leva: Leva, ref: unknown, id: string): void {
  if (typeof ref === "string" && ref.trim()) leva.apelidos[ref.trim()] = id;
}

/**
 * O que o modelo escreveu em `de`/`para`/`no` vira id: um apelido desta
 * leva, um rótulo de anexo (`@foto 1` — entra no grafo sozinho) ou o
 * próprio id. Devolve `null` quando nada bate.
 */
function resolverId(
  leva: Leva,
  ctx: ContextoDaLeva,
  ocupados: Ocupado[],
  bruto: unknown,
  { anexos }: { anexos: boolean },
): string | null {
  const valor = String(bruto ?? "").trim();
  if (!valor) return null;
  if (leva.apelidos[valor]) return leva.apelidos[valor];

  const { nodes } = useWorkflowStore.getState();
  if (nodes.some((n) => n.id === valor) || leva.novosNos.some((n) => n.id === valor)) return valor;

  if (anexos && acharAnexo(ctx, valor)) {
    const usado = usarAnexo(leva, { anexo: valor }, ctx, ocupados);
    return usado?.noId ?? null;
  }
  return null;
}

/**
 * O número do rótulo, contado do mesmo jeito que o `addNode` conta:
 * `nodeCounters[tipo] + 1`, e não "quantos nós desse tipo existem".
 *
 * A diferença aparece depois de apagar um nó — aí os existentes ficam
 * abaixo do contador, e numerar pelos existentes repetiria um número já
 * usado. Enquanto não havia como avançar o contador sem empilhar
 * desfazer, contar os existentes era o menos errado; agora que
 * `avancarContadores` existe, as duas numerações são a mesma.
 */
function proximoNumero(leva: Leva, tipo: string): number {
  const { nodeCounters } = useWorkflowStore.getState();
  const naLeva = leva.novosNos.filter((n) => n.type === tipo).length;
  return (nodeCounters[tipo] ?? 0) + naLeva + 1;
}

function criarNo(leva: Leva, args: Record<string, unknown>, ocupados: { x: number; y: number; w: number; h: number }[]): string | null {
  const tipo = args.tipo as string;
  if (!TIPOS_PARA_IA.includes(tipo as TipoParaIA)) {
    leva.falhas.push(`tipo de nó desconhecido: ${tipo}`);
    return null;
  }

  const { w, h } = tamanho(tipo);
  const lugar =
    typeof args.x === "number" && typeof args.y === "number"
      ? { x: args.x, y: args.y }
      : posicaoLivre(ocupados, w, h);
  ocupados.push({ ...lugar, w, h });

  const data: NodeData = { label: getNodeLabel(tipo, proximoNumero(leva, tipo)), status: "idle" };
  if (typeof args.prompt === "string" && args.prompt) {
    data[tipo === "commentNode" ? "comment" : "prompt"] = args.prompt;
  }
  const modelo = modeloValido(tipo, args.modelo);
  if (modelo) data[campoDoModelo(tipo)] = modelo;
  else if (args.modelo) leva.falhas.push(`modelo inexistente: ${String(args.modelo)}`);
  if (typeof args.proporcao === "string") data.aspectRatio = args.proporcao;

  const id = novoId(tipo);
  leva.novosNos.push({ id, type: tipo, position: lugar, style: { width: w, height: h }, data });
  registrarApelido(leva, args.ref, id);
  return id;
}

function conectar(
  leva: Leva,
  args: Record<string, unknown>,
  ctx: ContextoDaLeva,
  ocupados: Ocupado[],
): boolean {
  const entrada = String(args.entrada ?? "") as Entrada;

  if (!ENTRADAS.includes(entrada)) {
    leva.falhas.push(`entrada desconhecida: ${entrada}`);
    return false;
  }

  /* A origem pode ser um anexo (`@foto 1`): ele entra no grafo aqui
     mesmo. O destino não — um anexo não recebe ligação. */
  const de = resolverId(leva, ctx, ocupados, args.de, { anexos: true });
  const para = resolverId(leva, ctx, ocupados, args.para, { anexos: false });
  if (!de || !para) {
    leva.falhas.push(`ligação com nó inexistente: ${String(args.de ?? "")} → ${String(args.para ?? "")}`);
    return false;
  }

  leva.novasArestas.push({
    id: novoId("edge"),
    source: de,
    target: para,
    targetHandle: entrada,
    animated: false,
    style: edgeStyle(entrada),
  });
  return true;
}

function definirNo(leva: Leva, args: Record<string, unknown>): boolean {
  const bruto = String(args.no ?? "").trim();
  const id = leva.apelidos[bruto] ?? bruto;
  const { nodes } = useWorkflowStore.getState();
  const alvo = nodes.find((n) => n.id === id) ?? leva.novosNos.find((n) => n.id === id);
  if (!alvo) {
    leva.falhas.push(`nó inexistente: ${bruto}`);
    return false;
  }

  const data: Partial<NodeData> = {};
  if (typeof args.prompt === "string") {
    data[alvo.type === "commentNode" ? "comment" : "prompt"] = args.prompt;
  }
  const modelo = modeloValido(alvo.type ?? "", args.modelo);
  if (modelo) data[campoDoModelo(alvo.type ?? "")] = modelo;
  else if (args.modelo) leva.falhas.push(`modelo inexistente: ${String(args.modelo)}`);
  if (typeof args.proporcao === "string") data.aspectRatio = args.proporcao;
  if (typeof args.duracao === "number") data.duration = args.duracao;
  if (typeof args.som === "boolean") data.sound = args.som;

  /* Um nó recém-criado nesta mesma leva ainda não está no store: muda-se
     o objeto em memória, senão a alteração se perderia. */
  const novo = leva.novosNos.find((n) => n.id === id);
  if (novo) novo.data = { ...novo.data, ...data };
  else leva.alteracoes.push({ id, data });
  return true;
}

/* ── O anexo vira nó ──────────────────────────────────────────
   O mesmo desenho de `lib/projetoNos.ts` (imagem → `imageInputNode`
   com `r2Url`/`inputImage`; vídeo → `videoInputNode` com `videoUrl`),
   mas dentro da leva: entra no lote, sob o mesmo desfazer. Se o anexo já
   virou nó — pelo chip do chat ou por uma leva anterior — devolve o que
   existe, em vez de duplicar a foto no grafo. */
function acharAnexo(ctx: ContextoDaLeva, rotulo: unknown): Anexo | null {
  const alvo = String(rotulo ?? "").trim().replace(/^@/, "").toLowerCase().replace(/\s+/g, " ");
  return ctx.anexos.find((a) => a.rotulo.toLowerCase() === alvo) ?? null;
}

function usarAnexo(
  leva: Leva,
  args: Record<string, unknown>,
  ctx: ContextoDaLeva,
  ocupados: { x: number; y: number; w: number; h: number }[],
): { noId: string; anexoId: string; novo: boolean } | null {
  const anexo = acharAnexo(ctx, args.anexo);
  if (!anexo) {
    leva.falhas.push(`anexo desconhecido: ${String(args.anexo ?? "")}`);
    return null;
  }

  const { nodes } = useWorkflowStore.getState();
  const jaNoGrafo = anexo.noId && nodes.some((n) => n.id === anexo.noId)
    ? anexo.noId
    : leva.anexosUsados.find((u) => u.anexoId === anexo.id)?.noId;
  if (jaNoGrafo) return { noId: jaNoGrafo, anexoId: anexo.id, novo: false };

  const tipo = anexo.tipo === "video" ? "videoInputNode" : "imageInputNode";
  /* A caixa nasce na proporção do arquivo, com a largura padrão do tipo. */
  const { w } = tamanho(tipo);
  const h = Math.max(120, Math.round((w * anexo.altura) / Math.max(1, anexo.largura)));
  const lugar = posicaoLivre(ocupados, w, h);
  ocupados.push({ ...lugar, w, h });

  const efemera = !anexo.duravel || anexo.url.startsWith("data:");
  /* O nó de imagem desenha a foto com `object-fit: fill` dentro de uma
     caixa cuja proporção é `imageNaturalRatio` — sem ele cai em 1:1 e um
     print vertical sai esmagado num quadrado. A proporção já foi medida
     quando o anexo entrou no chat; vai daqui para o nó. */
  const data: NodeData = {
    label: getNodeLabel(tipo, proximoNumero(leva, tipo)),
    status: "done",
    ...(anexo.tipo === "video"
      ? { videoUrl: anexo.url }
      : {
          imageNaturalRatio: `${anexo.largura} / ${anexo.altura}`,
          ...(efemera ? { inputImage: anexo.url } : { r2Url: anexo.url, inputImage: anexo.url }),
        }),
  };

  const id = novoId(tipo);
  leva.novosNos.push({ id, type: tipo, position: lugar, style: { width: w, height: h }, data });
  leva.anexosUsados.push({ anexoId: anexo.id, noId: id });
  registrarApelido(leva, args.ref, id);
  return { noId: id, anexoId: anexo.id, novo: true };
}

/* A geometria do fluxo é a do `makeUGCTemplate`, que já resolve este
   mesmo desenho à mão: uma coluna por ramo, texto do vídeo em cima, os
   dois geradores no meio e o texto da imagem embaixo. */
const PASSO_X = 380;
const RECUO_X = 310;

function montarFluxo(
  leva: Leva,
  args: Record<string, unknown>,
  ctx: ContextoDaLeva,
  ocupados: { x: number; y: number; w: number; h: number }[],
): number {
  const bruto = Number(args.quantidade ?? 0);
  const quantidade = Math.max(1, Math.min(8, Math.round(Number.isFinite(bruto) ? bruto : 1)));
  const promptsImg = Array.isArray(args.prompts_imagem) ? (args.prompts_imagem as string[]) : [];
  const promptsVid = Array.isArray(args.prompts_video) ? (args.prompts_video as string[]) : [];
  const proporcao = typeof args.proporcao === "string" ? args.proporcao : "9:16";
  const referencias = Array.isArray(args.referencias) ? (args.referencias as unknown[]) : [];

  const modeloImg = modeloValido("generateNode", args.modelo_imagem) ?? IMAGE_MODELS[0].id;
  const modeloVid = modeloValido("videoGeneratorNode", args.modelo_video) ?? VIDEO_MODELS[0].id;

  const { nodes } = useWorkflowStore.getState();
  /* O fluxo novo nasce abaixo de tudo o que já existe, para nunca cair
     por cima de um grafo que já estava lá. */
  const baseY = nodes.length
    ? Math.max(...nodes.map((n) => n.position.y + (tamanho(n.type ?? "").h))) + 200
    : 0;

  for (let i = 0; i < quantidade; i++) {
    const x = i * PASSO_X;
    const idTxtVid = novoId("pv");
    const idVid = novoId("vg");
    const idImg = novoId("ig");
    const idTxtImg = novoId("pt");

    leva.novosNos.push({
      id: idTxtVid,
      type: "promptNode",
      position: { x: x + RECUO_X * 2, y: baseY },
      style: { width: 260, height: 390 },
      data: {
        label: getNodeLabel("promptNode", proximoNumero(leva, "promptNode")),
        status: "idle",
        prompt: promptsVid[i] ?? "",
      },
    });

    leva.novosNos.push({
      id: idVid,
      type: "videoGeneratorNode",
      position: { x: x + RECUO_X * 2, y: baseY + 430 },
      style: { width: 320, height: 220 },
      data: {
        label: getNodeLabel("videoGeneratorNode", proximoNumero(leva, "videoGeneratorNode")),
        status: "idle",
        videoModel: modeloVid,
        aspectRatio: proporcao,
      },
    });

    leva.novosNos.push({
      id: idImg,
      type: "generateNode",
      position: { x, y: baseY + 1050 },
      style: { width: 280, height: 280 },
      data: {
        label: getNodeLabel("generateNode", proximoNumero(leva, "generateNode")),
        status: "idle",
        model: modeloImg,
        aspectRatio: proporcao,
      },
    });

    leva.novosNos.push({
      id: idTxtImg,
      type: "promptNode",
      position: { x, y: baseY + 1630 },
      style: { width: 260, height: 390 },
      data: {
        label: getNodeLabel("promptNode", proximoNumero(leva, "promptNode")),
        status: "idle",
        prompt: promptsImg[i] ?? "",
      },
    });

    leva.novasArestas.push(
      { id: novoId("edge"), source: idTxtImg, target: idImg, targetHandle: "prompt", animated: false, style: edgeStyle("prompt") },
      { id: novoId("edge"), source: idImg, target: idVid, targetHandle: "startFrame", animated: false, style: edgeStyle("startFrame") },
      { id: novoId("edge"), source: idTxtVid, target: idVid, targetHandle: "prompt", animated: false, style: edgeStyle("prompt") },
    );

    /* A referência do ramo: a foto do produto entra como nó de imagem e
       alimenta a entrada `image` do gerador — é o que faz o produto da
       foto chegar inteiro na cena nova. O mesmo rótulo em vários ramos
       reaproveita o mesmo nó, pelo `usarAnexo`. */
    /* Os quatro nós do ramo entram nos ocupados antes da referência, para
       o nó da foto não nascer em cima deles. */
    for (const no of leva.novosNos.slice(-4)) {
      const st = no.style as { width?: number; height?: number } | undefined;
      ocupados.push({ x: no.position.x, y: no.position.y, w: st?.width ?? 280, h: st?.height ?? 280 });
    }

    const rotulo = referencias[i];
    if (typeof rotulo === "string" && rotulo.trim()) {
      const usado = usarAnexo(leva, { anexo: rotulo }, ctx, ocupados);
      if (usado) {
        leva.novasArestas.push({
          id: novoId("edge"),
          source: usado.noId,
          target: idImg,
          targetHandle: "image",
          animated: false,
          style: edgeStyle("image"),
        });
      }
    }
  }

  return quantidade;
}

/**
 * Roda as chamadas de um turno e devolve o que dizer ao modelo.
 *
 * Nada é escrito no `space` até o fim: as chamadas se acumulam numa
 * `Leva` e só então saem, atrás de UM `pushUndoSnapshot`.
 */
export function aplicarChamadas(
  chamadas: ChamadaFerramenta[],
  ctx: ContextoDaLeva = { anexos: [] },
): {
  resultados: ResultadoFerramenta[];
  resumo: ResumoDaLeva;
} {
  const leva: Leva = {
    novosNos: [], novasArestas: [], alteracoes: [], falhas: [], anexosUsados: [], apelidos: {},
  };
  const resultados: ResultadoFerramenta[] = [];

  /* O tamanho de verdade é o do `style` (é de lá que o canvas lê a caixa
     de um nó criado fora dele); o padrão do tipo só entra quando não há
     `style`. Com o padrão para todos, um texto de 390 de altura contava
     como 200 e o nó novo nascia em cima dele. */
  const { nodes } = useWorkflowStore.getState();
  const ocupados: Ocupado[] = nodes.map((n) => {
    const st = n.style as { width?: number | string; height?: number | string } | undefined;
    const padrao = tamanho(n.type ?? "");
    const w = typeof st?.width === "number" ? st.width : (n.measured?.width ?? padrao.w);
    const h = typeof st?.height === "number" ? st.height : (n.measured?.height ?? padrao.h);
    return { x: n.position.x, y: n.position.y, w, h };
  });

  for (const c of chamadas) {
    switch (c.nome) {
      case "criar_no": {
        const id = criarNo(leva, c.argumentos, ocupados);
        resultados.push({
          id: c.id,
          nome: c.nome,
          saida: id ? `nó criado com id ${id}` : "não foi possível criar o nó",
          erro: !id,
        });
        break;
      }
      case "conectar": {
        const ok = conectar(leva, c.argumentos, ctx, ocupados);
        resultados.push({ id: c.id, nome: c.nome, saida: ok ? "ligado" : "não foi possível ligar", erro: !ok });
        break;
      }
      case "definir_no": {
        const ok = definirNo(leva, c.argumentos);
        resultados.push({ id: c.id, nome: c.nome, saida: ok ? "nó atualizado" : "nó não encontrado", erro: !ok });
        break;
      }
      case "montar_fluxo_imagem_video": {
        const n = montarFluxo(leva, c.argumentos, ctx, ocupados);
        const ids = leva.novosNos
          .filter((no) => no.type === "generateNode" || no.type === "videoGeneratorNode")
          .map((no) => `${no.id} [${no.type}]`)
          .join(", ");
        resultados.push({
          id: c.id,
          nome: c.nome,
          saida: `fluxo montado com ${n} ramo(s): ${n * 4} nós e ${n * 3} ligações. Geradores: ${ids}`,
        });
        break;
      }
      case "usar_anexo": {
        const usado = usarAnexo(leva, c.argumentos, ctx, ocupados);
        resultados.push({
          id: c.id,
          nome: c.nome,
          saida: usado
            ? usado.novo
              ? `anexo no grafo como nó ${usado.noId}`
              : `o anexo já estava no grafo como nó ${usado.noId}`
            : `anexo não encontrado: ${String(c.argumentos.anexo ?? "")}`,
          erro: !usado,
        });
        break;
      }
      default:
        leva.falhas.push(`ferramenta desconhecida: ${c.nome}`);
        resultados.push({ id: c.id, nome: c.nome, saida: `ferramenta desconhecida: ${c.nome}`, erro: true });
    }
  }

  const escreveu =
    leva.novosNos.length > 0 || leva.novasArestas.length > 0 || leva.alteracoes.length > 0;

  if (escreveu) {
    const store = useWorkflowStore.getState();

    /* A ÚNICA foto, e ela é tirada antes de qualquer escrita. */
    store.pushUndoSnapshot();

    if (leva.novosNos.length) {
      store.onNodesChange(
        leva.novosNos.map((item) => ({ type: "add", item }) as NodeChange<Node<NodeData>>),
      );
    }
    if (leva.novasArestas.length) {
      store.onEdgesChange(leva.novasArestas.map((item) => ({ type: "add", item }) as EdgeChange));
    }
    /* `updateNodeData` não empilha desfazer — pode ir depois do lote. */
    for (const a of leva.alteracoes) store.updateNodeData(a.id, a.data);

    /* Os contadores por último, e uma vez só: é o que faz o próximo nó
       criado à mão continuar a numeração em vez de repetir um rótulo.
       `avancarContadores` também não empilha snapshot, então o desfazer
       continua sendo um. */
    if (leva.novosNos.length) {
      const porTipo: Record<string, number> = {};
      for (const n of leva.novosNos) {
        const t = n.type ?? "unknown";
        porTipo[t] = (porTipo[t] ?? 0) + 1;
      }
      store.avancarContadores(porTipo);
    }
  }

  return {
    resultados,
    resumo: {
      nosCriados: leva.novosNos.length,
      arestasCriadas: leva.novasArestas.length,
      nosAlterados: leva.alteracoes.length,
      falhas: leva.falhas,
      anexosUsados: leva.anexosUsados,
    },
  };
}

/** Uma frase para a conversa, com o que a leva fez de fato. */
export function resumoEmTexto(r: ResumoDaLeva): string {
  const partes: string[] = [];
  if (r.nosCriados) partes.push(`${r.nosCriados} ${r.nosCriados === 1 ? "nó" : "nós"}`);
  if (r.arestasCriadas) partes.push(`${r.arestasCriadas} ${r.arestasCriadas === 1 ? "ligação" : "ligações"}`);
  if (r.nosAlterados) partes.push(`${r.nosAlterados} ${r.nosAlterados === 1 ? "nó alterado" : "nós alterados"}`);
  if (partes.length === 0) return "Nada foi escrito no grafo.";
  return `No grafo: ${partes.join(", ")}. Um Ctrl+Z desfaz tudo de uma vez.`;
}

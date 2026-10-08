"use client";

/* ============================================================
   O ARTEFATO VIRA NÓ — a ponte entre a Conversa e o `space`

   `/projeto/<id>` e `/workflow/<id>` são o MESMO projeto visto de dois
   jeitos, e o `space` do `lib/store.ts` é o único lugar onde o conteúdo
   mora. Até a leva 5 o artefato gerado existia só no plano da Conversa:
   recarregou, sumiu; abriu o Grafo, não estava lá. Este arquivo é o que
   fecha esse buraco.

   ── A divisão de trabalho, que é o que evita o desastre da leva 2 ──

     `lib/projetoSessao.ts`  guarda a CONVERSA: mensagens, status, quem
                             falou o quê. Não é fonte de conteúdo.
     o `space`               guarda o RESULTADO: cada artefato é um nó,
                             ao lado das arestas e de tudo o mais que o
                             Grafo já punha ali.

   Nada aqui importa arquivo da frente do canvas. O combinado com ela é
   **o formato do nó no `space`**, e só. Ela lê o que estiver lá.

   ── Por que a escrita passa pelas ações públicas do store ──

   `addNode`, `updateNodeData` e `updateNodeSize` já fazem três coisas
   que eu teria de refazer errado se escrevesse no array na unha: contam
   o rótulo por tipo, empilham o desfazer e chamam o `syncSpace`, que é
   quem grava no `space` e dispara a persistência. Escrever "só o nó"
   seria perder as três.

   Todas elas agem sobre o `space` ATIVO. É por isso que a rota do
   projeto chama `switchSpace(id)` ao abrir, exatamente como
   `app/workflow/[id]/page.tsx` já fazia — e é também por isso que aqui
   existe uma trava: se o ativo não for o projeto, não escrevo em
   nenhum, em vez de escrever no errado.
   ============================================================ */

import type { Node } from "@xyflow/react";
import { useWorkflowStore, type NodeData, type NodeStatus } from "@/lib/store";
import { NODE_SIZE, FALLBACK_SIZE } from "@/lib/nodeTypes";
import type { Artefato, TipoArtefato } from "@/lib/projetoSessao";

/* ── O contrato com a vista Conversa ──────────────────────────
   Estes três valores são o combinado; eles vivem aqui e lá em cópia, de
   propósito: o combinado é o FORMATO DO NÓ, não um import cruzado. Se um
   dia o Maestro quiser um só lugar, é um arquivo de constantes na `lib/`,
   não uma frente importando a outra. */

/** Onde a Conversa guarda o tipo do bloco quando o nó não o revela. */
export const CAMPO_TIPO_BLOCO = "blocoTipo";

/**
 * Que tipo de nó cada mídia vira, e por quê a origem importa.
 *
 * Um RESULTADO DE GERAÇÃO vira o gerador que o produziu — o nó carrega o
 * modelo e mostra a saída em `imageUrl`/`videoUrl`. Um ARQUIVO ANEXADO
 * não foi gerado por ninguém: é recurso, e o workflow já tem o tipo
 * certo para isso (`imageInputNode`, que sabe desenhar tanto uma URL
 * durável quanto um `data:` de sessão). Mandar um anexo como
 * `generateNode` seria dizer que ele saiu de um modelo, e ainda por cima
 * ele não apareceria: o gerador desenha `imageUrl`, não `inputImage`.
 *
 * `3d` e `audio` não têm modelo nenhum no workflow. Um tipo inexistente
 * faria o `<ReactFlow>` montar um nó sem componente e sumir da tela, que
 * é a perda que esta leva existe para impedir. Viram nota, com o tipo
 * carregado no `data` para voltarem inteiros.
 */
export const NO_DA_MIDIA: Record<TipoArtefato, string> = {
  imagem: "generateNode",
  video: "videoGeneratorNode",
  "3d": "commentNode",
  audio: "commentNode",
};

const NO_DO_ANEXO: Partial<Record<TipoArtefato, string>> = {
  imagem: "imageInputNode",
  video: "videoInputNode",
};

function tipoDeNo(a: Artefato): string {
  if (a.origem === "anexo") return NO_DO_ANEXO[a.tipo] ?? NO_DA_MIDIA[a.tipo];
  return NO_DA_MIDIA[a.tipo];
}

/** O primeiro nó nasce onde a referência põe o dela. */
export const ORIGEM = { x: 862, y: 190 };
/** Vão entre um artefato e o vizinho, quando o lugar já está ocupado. */
const VAO = 48;

/* ── Posição ──────────────────────────────────────────────── */

function tamanhoDoNo(n: Node<NodeData>): { w: number; h: number } {
  const padrao = NODE_SIZE[n.type ?? ""] ?? FALLBACK_SIZE;
  const w = n.style?.width;
  const h = n.style?.height;
  return {
    w: typeof w === "number" ? w : (n.measured?.width ?? padrao.w),
    h: typeof h === "number" ? h : (n.measured?.height ?? padrao.h),
  };
}

function encosta(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Um lugar livre para uma caixa de `w × h`.
 *
 * Varre para a direita a partir da origem e, quando a faixa acaba, desce
 * uma linha. Não é empacotamento ótimo — é o suficiente para que dois
 * artefatos seguidos não nasçam um em cima do outro, que era o defeito
 * de verdade: até aqui todos nasciam em (862, 190).
 */
export function posicaoLivre(
  nos: Node<NodeData>[],
  w: number,
  h: number,
): { x: number; y: number } {
  const ocupados = nos.map((n) => ({ x: n.position.x, y: n.position.y, ...tamanhoDoNo(n) }));
  const porLinha = 4;

  for (let linha = 0; linha < 64; linha++) {
    for (let coluna = 0; coluna < porLinha; coluna++) {
      const alvo = {
        x: ORIGEM.x + coluna * (w + VAO),
        y: ORIGEM.y + linha * (h + VAO),
        w,
        h,
      };
      if (!ocupados.some((o) => encosta(alvo, o))) return { x: alvo.x, y: alvo.y };
    }
  }

  /* 64 linhas cheias é cenário impossível na prática; ainda assim é
     melhor devolver um lugar previsível do que `undefined`. */
  return { x: ORIGEM.x, y: ORIGEM.y + 64 * (h + VAO) };
}

/* ── Escrita ──────────────────────────────────────────────── */

/** Verdadeiro quando o `space` ativo é o do projeto — ver o cabeçalho. */
function espacoCerto(projetoId: string): boolean {
  const { activeSpaceId } = useWorkflowStore.getState();
  if (activeSpaceId === projetoId) return true;
  console.warn(
    `[projeto] o space ativo (${activeSpaceId}) não é o do projeto (${projetoId}); ` +
      "o nó não foi escrito, para não cair no espaço errado.",
  );
  return false;
}

function estadoDoNo(a: Artefato): NodeStatus {
  if (a.estado === "pronto") return "done";
  if (a.estado === "erro") return "error";
  return "running";
}

/**
 * O campo em que a URL entra.
 *
 * O `NodeData` já separa `inputImage` ("base64, só enquanto a sessão
 * vive") de `r2Url` ("durável, usado depois do upload"). Um `data:` de
 * anexo é exatamente o primeiro caso, e pô-lo em `imageUrl` faria o
 * Grafo tratá-lo como resultado durável de uma geração.
 */
function campoDaUrl(a: Artefato): "imageUrl" | "inputImage" | "r2Url" | "videoUrl" | "comment" {
  /* 3D e áudio viajam como nota: o link vira o texto dela, que é o que
     impede a URL de se perder enquanto não existe um nó para eles. */
  if (a.tipo === "3d" || a.tipo === "audio") return "comment";

  const efemera = a.duravel === false || !!a.url?.startsWith("data:");

  /* O anexo é recurso: o nó de entrada lê `inputImage` (base64 de
     sessão) ou `r2Url` (durável), e o `partialize` do store já limpa o
     primeiro sozinho ao gravar. */
  if (a.origem === "anexo") return efemera ? "inputImage" : "r2Url";

  /* O resultado é saída do gerador. Um `data:` aqui iria inteiro para o
     `localStorage`; o `inputImage` é o único campo que o store limpa. */
  if (efemera) return "inputImage";
  return a.tipo === "video" ? "videoUrl" : "imageUrl";
}

/**
 * Põe o artefato no `space` como nó e devolve o id do nó.
 *
 * O nó nasce junto com o artefato, ainda em `running`: é isso que faz o
 * Grafo mostrar a geração em curso, do mesmo jeito que a Conversa mostra
 * o placeholder. A caixa já vem no tamanho final, então a mídia entra
 * depois sem mexer em nada.
 */
export function abrirNoDoArtefato(
  projetoId: string,
  a: Artefato,
): { id: string; x: number; y: number } | null {
  if (!espacoCerto(projetoId)) return null;

  const estado = useWorkflowStore.getState();
  const tipo = tipoDeNo(a);
  const lugar = posicaoLivre(estado.nodes, a.largura, a.altura);
  const campo = campoDaUrl(a);

  const data: NodeData = {
    label: "",
    status: estadoDoNo(a),
    ...(a.modelo ? { model: a.modelo } : {}),
    ...(a.url ? { [campo]: a.url } : {}),
    ...(tipo === "commentNode" ? { [CAMPO_TIPO_BLOCO]: a.tipo } : {}),
    /* O `imageInputNode` tira a proporção da caixa de `imageNaturalRatio`;
       sem ele a foto anexada era esticada num 1:1. A geometria do
       artefato já é a da imagem — é só passá-la adiante. */
    ...(tipo === "imageInputNode" && a.largura > 0 && a.altura > 0
      ? { imageNaturalRatio: `${a.largura} / ${a.altura}` }
      : {}),
  };

  const no: Node<NodeData> = {
    id: a.id,
    type: tipo,
    position: lugar,
    /* O tamanho vai no `style` porque é de lá que o Grafo lê a caixa de
       um nó criado fora dele. Sem isso o artefato de 1024 chegaria lá
       com o tamanho padrão do tipo. */
    style: { width: a.largura, height: a.altura },
    data,
  };

  estado.addNode(no);
  /* Devolve o lugar escolhido: quem chamou grava-o no artefato, para a
     miniatura da Conversa e o nó do Grafo apontarem o mesmo ponto. */
  return { id: no.id, x: lugar.x, y: lugar.y };
}

/**
 * Leva ao nó o que mudou no artefato: a URL quando a geração termina, o
 * erro quando ela falha. O nó já existe — nada de identidade nova, senão
 * a ida e volta entre as vistas duplicaria tudo.
 */
export function atualizarNoDoArtefato(projetoId: string, a: Artefato): void {
  if (!espacoCerto(projetoId)) return;

  const estado = useWorkflowStore.getState();
  if (!estado.nodes.some((n) => n.id === a.id)) {
    /* O artefato existe e o nó não: aconteceu antes desta leva, ou o
       `space` foi limpo. Recriar é melhor que deixar a Conversa e o
       Grafo discordando. */
    abrirNoDoArtefato(projetoId, a);
    return;
  }

  const campo = campoDaUrl(a);
  estado.updateNodeData(a.id, {
    status: estadoDoNo(a),
    ...(a.url ? { [campo]: a.url } : {}),
    ...(a.erro ? { errorMsg: a.erro, hasError: true } : {}),
  });
}

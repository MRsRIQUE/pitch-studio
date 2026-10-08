/* ============================================================
   SÉRIE → GERAÇÃO — as duas entregas de um episódio

   Um episódio montado (`montarEpisodio`) vira vídeo por dois caminhos,
   os mesmos que o Estruturar usa:

   1. COMPOSER — o prompt único (todos os planos em sequência + lock) vai
      para o composer de vídeo pela mesma porta do Remix: escreve na chave
      que o composer lê ao montar e navega. Um take só, duração total.

   2. GRAFO — um `promptNode` → `videoGeneratorNode` por plano, no mesmo
      molde de `moldeDoGrafo` (lib/estruturaIdeia.ts). Cada plano vira um
      clipe com a duração arredondada para o que o modelo aceita, e a
      montagem final fica para a edição. Nada é gerado ao montar.

   O modelo de vídeo é escolhido aqui, não na tela: precisa aceitar 9:16
   e duração ajustável, senão o "1,5 s do hook" não tem como existir.
   ============================================================ */

import type { Edge, Node } from "@xyflow/react";
import { VIDEO_MODELS } from "@/lib/modelConfig";
import type { NodeData } from "@/lib/store";
import { edgeStyle } from "@/lib/edgeStyles";
import { remixToComposer } from "@/lib/remixHandoff";
import type { Molde } from "@/lib/estruturaIdeia";
import type { EpisodioMontado, PlanoMontado } from "@/lib/serieKit";

const PREFERIDOS = ["seedance-2-5", "seedance-2", "kling-3.0", "minimax-h3", "seedance-2-fast"];

/** O primeiro modelo preferido que existe no catálogo e aceita 9:16 com duração. */
export function modeloVideoDaSerie(): { id: string; nome: string; durations: number[] } {
  const aceita = (m: (typeof VIDEO_MODELS)[number]) => m.ratios.includes("9:16") && m.durations.length > 0;
  const preferido = PREFERIDOS.map((id) => VIDEO_MODELS.find((m) => m.id === id)).find((m) => m && aceita(m));
  const escolhido = preferido ?? VIDEO_MODELS.find(aceita) ?? VIDEO_MODELS[0];
  return { id: escolhido.id, nome: escolhido.name, durations: escolhido.durations };
}

/** A duração do clipe de um plano: o tempo do plano arredondado para cima e
 *  encaixado no que o modelo aceita. Um hook de 1,5 s vira um clipe de 4 s
 *  que a edição corta — o modelo não gera menos que isso. */
export function duracaoDoClipe(plano: Pick<PlanoMontado, "inicio" | "fim">, durations: number[]): number | undefined {
  if (durations.length === 0) return undefined;
  const alvo = Math.ceil(plano.fim - plano.inicio);
  const ordenadas = [...durations].sort((a, b) => a - b);
  return ordenadas.find((d) => d >= alvo) ?? ordenadas[ordenadas.length - 1];
}

/** Duração do episódio inteiro, encaixada no modelo. */
export function duracaoDoTake(ep: EpisodioMontado, durations: number[]): number | undefined {
  return duracaoDoClipe({ inicio: 0, fim: ep.duracao }, durations);
}

/** Leva o prompt único para o composer de vídeo. Devolve a rota, ou `null`. */
export function episodioParaComposer(ep: EpisodioMontado): string | null {
  const modelo = modeloVideoDaSerie();
  return remixToComposer({ prompt: ep.promptUnico, model: modelo.id, aspectRatio: "9:16", mediaType: "video" });
}

/** Um plano só para o composer — para regerar um hook sem refazer o resto. */
export function planoParaComposer(plano: PlanoMontado): string | null {
  const modelo = modeloVideoDaSerie();
  return remixToComposer({ prompt: plano.prompt, model: modelo.id, aspectRatio: "9:16", mediaType: "video" });
}

const PASSO_X = 380;

/** Um par prompt → vídeo por plano, lado a lado, na ordem da montagem. */
export function moldeDoEpisodio(ep: EpisodioMontado): Molde {
  const modelo = modeloVideoDaSerie();
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  ep.planos.forEach((plano, i) => {
    const x = i * PASSO_X;
    const idPrompt = `ser-pt-${plano.n}`;
    const idVideo = `ser-vg-${plano.n}`;
    const duration = duracaoDoClipe(plano, modelo.durations);

    nodes.push({
      id: idPrompt,
      type: "promptNode",
      position: { x, y: -430 },
      style: { width: 260, height: 390 },
      data: { label: `Shot ${plano.n} · ${plano.tempo}`, status: "idle", prompt: plano.prompt },
    });
    nodes.push({
      id: idVideo,
      type: "videoGeneratorNode",
      position: { x, y: 0 },
      style: { width: 320, height: 220 },
      data: {
        label: `Video Generator #${plano.n}`,
        status: "idle",
        videoModel: modelo.id,
        aspectRatio: "9:16",
        ...(duration ? { duration } : {}),
      },
    });
    edges.push({
      id: `ser-e-pt${plano.n}-vg${plano.n}`,
      source: idPrompt,
      target: idVideo,
      targetHandle: "prompt",
      animated: false,
      style: edgeStyle("prompt"),
    });
  });

  return { nodes, edges, nodeCounters: { promptNode: ep.planos.length, videoGeneratorNode: ep.planos.length } };
}

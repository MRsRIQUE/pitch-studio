/* ============================================================
   CICLO — o dicionário e o contrato

   Os rótulos são a tradução das chaves que o §7 do `INFO.md` do bloco 09
   transcreveu do i18n da referência (`subagent`, `mediaToolProgress`,
   `mediaResult`, `thinkBlock`, `statusBar`). Nada foi inventado: cada linha
   abaixo tem a chave original ao lado, para a auditoria ser uma comparação e
   não uma leitura de fé.

   O contrato de dados fica aqui porque as três peças do ciclo (placeholder,
   barra de status e rastro) precisam dele e nenhuma delas deve importar a
   outra. Este arquivo não importa nada de nenhuma frente: a costura com o
   `lib/projetoSessao.ts` do painel é por props e callbacks, e acontece na
   página — que não é minha.
   ============================================================ */

/** As fases observáveis de um turno. */
export type FaseCiclo = "enviado" | "gerando" | "resultado" | "erro";

export type MidiaCiclo = "imagem" | "video";

export interface ArtefatoCiclo {
  id: string;
  /** Devolvido pelo `/api/generate`; é por ele que o SSE acha o resultado. */
  taskId?: string;
  midia: MidiaCiclo;
  modelId: string;
  modelName: string;
  aspectRatio: string;
  /**
   * A geometria que já é conhecida no envio — é o que permite o placeholder
   * nascer no tamanho final e a imagem entrar sem reflow. Na referência ela vem
   * do backend; aqui vem da proporção que o usuário escolheu, que é a mesma
   * informação, sabida antes de a mídia existir.
   */
  larguraMundo: number;
  alturaMundo: number;
  url?: string;
}

export interface TurnoCiclo {
  id: string;
  prompt: string;
  fase: FaseCiclo;
  artefato: ArtefatoCiclo;
  /** t0 — o usuário apertou enviar. */
  enviadoEm: number;
  /** t1 — o `/api/generate` devolveu o taskId. É o fim do "pensando". */
  aceitoEm?: number;
  /** t2 — o `/api/job-stream` resolveu. */
  concluidoEm?: number;
  erro?: string;
  /** Voto da régua; exclusivo entre si, como na referência. */
  voto?: "cima" | "baixo";
}

/* ── Dicionário ──────────────────────────────────────────────
   Chave original → rótulo em português. */
export const T = {
  /** thinkBlock.deepThinking */
  pensandoAFundo: "Pensando a fundo",

  /** statusBar.* */
  status: {
    thinking: "Pensando...",
    waiting: "Aguardando...",
    generating: "Gerando...",
    generateSuccess: "Pronto~",
    generateError: "Algo deu errado...",
  },

  /** mediaToolProgress.* — o texto da barra enquanto o artefato não chega */
  gerando: {
    imagem: "Gerando imagem",
    video: "Gerando vídeo",
  } as Record<MidiaCiclo, string>,

  /** mediaResult.* */
  midia: {
    generating: "Gerando",
    download: "Baixar",
    insertToCanvas: "Inserir no canvas",
    locate: "Localizar no canvas",
    edit: "Editar",
  },

  /** A régua da resposta — os quatro botões de §5 */
  regua: {
    copiar: "Copiar",
    copiado: "Copiado",
    cima: "Gostei",
    baixo: "Não gostei",
    mais: "Mais",
  },

  /**
   * subagent.buddyName / subagent.lifecycle.
   * A referência batiza os subagentes de "Buddy"; nós não temos subagente, temos
   * a fila de geração. O nome abaixo é o que ela é de verdade — está na lista de
   * perguntas do relatório, porque o mapa de afordâncias não cobre o bloco 09.
   */
  agente: {
    imagem: "Gerador de imagem",
    video: "Gerador de vídeo",
  } as Record<MidiaCiclo, string>,

  ciclo: {
    takenOver: (agente: string) => `${agente} assumiu a tarefa`,
    completed: (agente: string) => `${agente} concluiu a tarefa`,
    failed: (agente: string) => `${agente} encontrou um problema`,
  },
} as const;

/* ── Geometria do artefato ───────────────────────────────────
   A aresta longa de 1408 é a do nó medido na referência (1408×768 no mundo,
   788×430 na tela a 56%). Manter esse número faz o nó do canvas nascer com a
   mesma escala do bloco; a aresta curta sai da proporção real escolhida. */
const ARESTA_LONGA = 1408;

export function geometriaDoArtefato(aspectRatio: string): { largura: number; altura: number } {
  const [a, b] = aspectRatio.split(":").map(Number);
  /* "auto" e "custom" não dizem forma nenhuma antes da geração; o quadrado é o
     que o backend devolve por padrão nesses casos. */
  const razao = Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 ? a / b : 1;
  return razao >= 1
    ? { largura: ARESTA_LONGA, altura: Math.round(ARESTA_LONGA / razao) }
    : { largura: Math.round(ARESTA_LONGA * razao), altura: ARESTA_LONGA };
}

/** A duração literal do bloco `Deep thinking`, no formato da referência (`2.0s`). */
export function duracaoCurta(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}

/** A data que abre o turno do assistente. `Sep 5, 2026` → `5 de set. de 2026`. */
export function dataDoTurno(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

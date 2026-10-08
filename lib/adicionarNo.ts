/* ============================================================
   CRIAR NÓ NO CANVAS DE WORKFLOW

   A lógica de posicionamento vivia dentro de `AddNodeMenu.tsx`, como um
   `useCallback` fechado sobre o hook `screenToFlowPosition`. A leva 5 deu
   duas portas novas para a mesma ação — os botões de tipo na barra vertical
   e o menu do botão direito —, então ela saiu para cá inteira, sem mudar
   uma conta.

   O que este arquivo NÃO faz: hooks. Ele recebe a conversão tela→fluxo por
   parâmetro. O `AddNodeMenu` passa o `screenToFlowPosition` do provider; a
   barra passa `telaParaFluxo`, que lê a matriz do `.react-flow__viewport`
   direto do DOM. A barra é montada pelo `WorkflowCanvas`, arquivo congelado,
   e não dá para garantir que ela esteja sempre dentro de um provider —
   ler o DOM não depende disso e nunca está desatualizado.
   ============================================================ */

import { useWorkflowStore, type NodeData } from "@/lib/store";
import { NODE_SIZE, FALLBACK_SIZE, getLastNodeSettings, getDefaultNodeSize } from "@/lib/nodeTypes";

/** Distância entre o nó novo e o vizinho, em unidades de fluxo. */
const VAO = 40;
/** Recuo do primeiro nó em relação à borda esquerda do canvas. */
const RECUO_DA_BARRA = 80;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export interface Ponto {
  x: number;
  y: number;
}

/** O rótulo que cada tipo mostra no cabeçalho do nó. */
const NOME_EXIBIDO: Record<string, string> = {
  promptNode: "TEXT",
  imageInputNode: "IMAGE",
  videoInputNode: "VIDEO",
  generateNode: "IMAGE GEN",
  videoGeneratorNode: "VIDEO GEN",
  assistantNode: "ASSISTANT",
  commentNode: "COMMENT",
};

/**
 * Converte coordenada de tela em coordenada de fluxo lendo a matriz do
 * `.react-flow__viewport`. É o mesmo cálculo que o `screenToFlowPosition` faz
 * — `(tela - origem - pan) / zoom` — só que sem depender do provider.
 */
export function telaParaFluxo(p: Ponto): Ponto {
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  const container = document.querySelector(".react-flow") as HTMLElement | null;
  const caixa = container?.getBoundingClientRect();
  const origemX = caixa?.left ?? 0;
  const origemY = caixa?.top ?? 0;

  if (!viewport) return { x: p.x - origemX, y: p.y - origemY };
  const m = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
  /* Sem transform aplicado o navegador devolve a identidade; zoom 0 nunca
     acontece, mas dividir por ele daria Infinity silencioso. */
  const zoom = m.a || 1;
  return { x: (p.x - origemX - m.e) / zoom, y: (p.y - origemY - m.f) / zoom };
}

function seSobrepoem(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  folga = 0,
) {
  return ax - folga < bx + bw && ax + aw + folga > bx && ay - folga < by + bh && ay + ah + folga > by;
}

/**
 * Onde o nó nasce.
 *
 * Com `ponto`, o CANTO SUPERIOR ESQUERDO cai nele — é o caso do botão direito.
 * Cheguei a centrar no ponto e desfiz: `NODE_SIZE.generateNode` declara
 * 280×280 e o nó renderiza 280×498, porque o componente cresce com o conteúdo.
 * Centrar numa altura que o nó não respeita erra 47px na tela; ancorar o canto
 * é exato por construção e não depende do que o nó vira depois.
 *
 * Sem `ponto`, mantém exatamente o comportamento que o menu tinha antes:
 * canvas vazio → à esquerda, na altura do meio; canvas com nós → à direita do
 * vizinho mais próximo do centro da vista, empurrando até não sobrepor.
 */
export function posicionarNo(
  tipo: string,
  telaParaFluxoFn: (p: Ponto) => Ponto,
  ponto?: Ponto,
): Ponto {
  const container = document.querySelector(".react-flow") as HTMLElement | null;
  const caixa = container?.getBoundingClientRect();
  const estado = useWorkflowStore.getState();
  const tamanho = getDefaultNodeSize(tipo, estado.lastNodeSize);
  const nosAgora = estado.nodes;

  if (ponto) return telaParaFluxoFn(ponto);

  if (nosAgora.length === 0) {
    const telaX = (caixa?.left ?? 0) + RECUO_DA_BARRA;
    const telaY = caixa ? caixa.top + caixa.height / 2 : window.innerHeight / 2;
    const fluxo = telaParaFluxoFn({ x: telaX, y: telaY });
    return { x: fluxo.x, y: fluxo.y - tamanho.h / 2 };
  }

  const centroTela = {
    x: caixa ? caixa.left + caixa.width / 2 : window.innerWidth / 2,
    y: caixa ? caixa.top + caixa.height / 2 : window.innerHeight / 2,
  };
  const centroFluxo = telaParaFluxoFn(centroTela);

  let vizinho = nosAgora[0];
  let menorDist = Infinity;
  for (const n of nosAgora) {
    const s = NODE_SIZE[n.type ?? ""] ?? FALLBACK_SIZE;
    const d = Math.hypot(n.position.x + s.w / 2 - centroFluxo.x, n.position.y + s.h / 2 - centroFluxo.y);
    if (d < menorDist) { menorDist = d; vizinho = n; }
  }

  const tamVizinho = NODE_SIZE[vizinho.type ?? ""] ?? FALLBACK_SIZE;
  let x = vizinho.position.x + tamVizinho.w + VAO;
  const y = vizinho.position.y + tamVizinho.h / 2 - tamanho.h / 2;

  const MAX_TENTATIVAS = 40;
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const bate = nosAgora.some((n) => {
      const s = NODE_SIZE[n.type ?? ""] ?? FALLBACK_SIZE;
      return seSobrepoem(x, y, tamanho.w, tamanho.h, n.position.x, n.position.y, s.w, s.h, VAO / 2);
    });
    if (!bate) break;
    x += tamanho.w + VAO;
  }

  return { x, y };
}

/**
 * Cria o nó e devolve o id. `ponto` é a posição de TELA onde ele deve nascer;
 * sem ele, vale o posicionamento automático de sempre.
 */
export function criarNo(
  tipo: string,
  telaParaFluxoFn: (p: Ponto) => Ponto,
  opcoes?: { ponto?: Ponto; dados?: Partial<NodeData> },
): string {
  const estado = useWorkflowStore.getState();
  const tamanho = getDefaultNodeSize(tipo, estado.lastNodeSize);
  const nosAgora = estado.nodes;
  const contagem = nosAgora.filter((n) => n.type === tipo).length + 1;
  const posicao = posicionarNo(tipo, telaParaFluxoFn, opcoes?.ponto);

  const id = `${tipo}-${uid()}`;
  estado.addNode({
    id,
    type: tipo,
    position: posicao,
    /* Os dois nós de mídia crescem com o conteúdo: travar a altura deles
       cortaria a imagem. */
    style:
      tipo === "imageInputNode" || tipo === "videoInputNode"
        ? { width: tamanho.w }
        : { width: tamanho.w, height: tamanho.h },
    data: {
      label: `${NOME_EXIBIDO[tipo] ?? tipo} #${contagem}`,
      status: "idle",
      ...getLastNodeSettings(tipo, nosAgora),
      ...opcoes?.dados,
    },
  });
  /* O `addNode` do store sempre reescreve `label` com o contador do tipo
     ("IMAGE #3"). Quando quem chama pede um rótulo próprio — o seletor de
     personagens nomeia o nó com o nome da pessoa —, ele é aplicado depois,
     por cima do contador. O contador continua avançando normalmente. */
  if (opcoes?.dados?.label) {
    useWorkflowStore.getState().updateNodeData(id, { label: opcoes.dados.label });
  }
  return id;
}

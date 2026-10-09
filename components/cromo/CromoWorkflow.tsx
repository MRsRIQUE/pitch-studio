"use client";

/**
 * O cromo do bloco 09 vestindo `/workflow/<id>`.
 *
 * Duas das três peças moram aqui: a pílula do canto superior direito e a
 * barra de visualização do rodapé. A terceira — a barra vertical — é montada
 * pela `components/CanvasToolbar.tsx`, porque quem a posiciona é o
 * `WorkflowCanvas`, arquivo congelado, e o contrato de props dele não muda.
 *
 * O ZOOM É DE OUTRO DONO. O canvas desta tela é o `@xyflow/react`; quem sabe
 * a escala é o viewport DELE. `useViewport` e `useReactFlow` só respondem
 * dentro de um `ReactFlowProvider`, e é o `app/workflow/layout.tsx` que abre
 * esse provider por fora do `<ReactFlow>` — sem tocar no arquivo congelado.
 * O canvas de blocos que existia em `/projeto` foi aposentado na leva 7:
 * a Conversa passou a ser este mesmo grafo, com o painel de chat por cima.
 *
 * O QUE NÃO EXISTE NESTA TELA não é desenhado. Ver o relatório da leva 4:
 * fundo do canvas, alinhar à grade, minimapa, páginas e Compartilhar não têm
 * equivalente real no canvas de workflow, e botão morto é pior do que
 * controle ausente.
 */

import { useMemo, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import {
  ImageIcon, Film, Sparkles, MessageSquare, Bot, Package, Pencil,
} from "@/components/icones";
import { useWorkflowStore } from "@/lib/store";
import CromoPilulaTopo from "./CromoPilulaTopo";
import CromoBarraVisualizacao from "./CromoBarraVisualizacao";
import CromoCreditos from "./CromoCreditos";
import type { GrupoAtalhos, Icone, ItemCamada } from "./CromoTipos";

/** O glifo de cada tipo de nó, para a lista de Camadas. */
const ICONE_NO: Record<string, Icone> = {
  promptNode: Pencil,
  imageInputNode: ImageIcon,
  videoInputNode: Film,
  generateNode: Sparkles,
  videoGeneratorNode: Film,
  assistantNode: Bot,
  groupNode: Package,
  commentNode: MessageSquare,
};

/** O rótulo de cada tipo, quando o nó não tem `label` próprio. */
const ROTULO_NO: Record<string, string> = {
  promptNode: "Texto",
  imageInputNode: "Imagem de entrada",
  videoInputNode: "Vídeo de entrada",
  generateNode: "Gerar imagem",
  videoGeneratorNode: "Gerar vídeo",
  assistantNode: "Assistente",
  groupNode: "Grupo",
  commentNode: "Comentário",
};

/**
 * Os atalhos que o canvas de workflow implementa DE VERDADE. Todos conferidos
 * no `components/WorkflowCanvas.tsx` — o painel não promete tecla que a tela
 * não escuta.
 */
const ATALHOS_WORKFLOW: GrupoAtalhos[] = [
  {
    titulo: "Navegação no canvas",
    coluna: 0,
    itens: [
      { acao: "Deslocar o canvas", teclas: ["Mover", "Arrastar"] },
      { acao: "Deslocar com o botão direito", teclas: ["Botão dir.", "Arrastar"] },
      { acao: "Aproximar e afastar", teclas: ["Roda"] },
      { acao: "Ajustar a todo o conteúdo", teclas: ["Ajustar à tela"] },
    ],
  },
  {
    titulo: "Ferramentas",
    coluna: 0,
    itens: [
      { acao: "Ferramenta Selecionar", teclas: ["V"] },
      { acao: "Ferramenta Mover", teclas: ["H"] },
    ],
  },
  {
    titulo: "Edição de nós",
    coluna: 1,
    itens: [
      { acao: "Copiar a seleção", teclas: ["Ctrl", "C"] },
      { acao: "Colar", teclas: ["Ctrl", "V"] },
      { acao: "Desfazer", teclas: ["Ctrl", "Z"] },
      { acao: "Refazer", teclas: ["Ctrl", "⇧", "Z"] },
      { acao: "Refazer (alternativo)", teclas: ["Ctrl", "Y"] },
      { acao: "Excluir a seleção", teclas: ["Delete"] },
    ],
  },
  {
    titulo: "Seleção",
    coluna: 1,
    itens: [
      { acao: "Selecionar vários", teclas: ["⇧", "Clique"] },
      { acao: "Selecionar por área", teclas: ["Arrastar no vazio"] },
    ],
  },
];

export default function CromoWorkflow({
  camadasAberto,
  onCamadas,
  painelAberto,
  onAlternarPainel,
}: {
  /* O estado mora no layout porque é ele que carrega o `data-camadas` da
     raiz, e é esse atributo que faz as barras da direita recuarem os 240px
     do painel em vez de ficarem por baixo dele. */
  camadasAberto: boolean;
  onCamadas: (aberto: boolean) => void;
  /* O seletor `Conversa | Grafo` mostra e esconde o painel de chat; com ele
     escondido, sobra o grafo puro. Uma tela, duas leituras. */
  painelAberto: boolean;
  onAlternarPainel: () => void;
}) {
  const { zoom } = useViewport();
  const { zoomTo, fitView, setCenter, getNodes } = useReactFlow();

  const nos = useWorkflowStore((s) => s.nodes);
  const setSettingsOpen = useWorkflowStore((s) => s.setSettingsOpen);

  const [selecionado, setSelecionado] = useState<string | null>(null);

  const camadas: ItemCamada[] = useMemo(
    () =>
      nos.map((n) => ({
        id: n.id,
        rotulo: n.data?.label?.trim() || ROTULO_NO[n.type ?? ""] || "Nó",
        detalhe: n.type ? ROTULO_NO[n.type] : undefined,
        Icone: ICONE_NO[n.type ?? ""],
      })),
    [nos],
  );

  /** Clicar numa camada leva a câmera até o nó — é o `Locate on canvas` da
   *  referência, e aqui ele funciona porque o viewport é do xyflow. */
  const localizar = (id: string) => {
    setSelecionado(id);
    const alvo = getNodes().find((n) => n.id === id);
    if (!alvo) return;
    const w = alvo.measured?.width ?? 0;
    const h = alvo.measured?.height ?? 0;
    setCenter(alvo.position.x + w / 2, alvo.position.y + h / 2, { zoom, duration: 300 });
  };

  return (
    <>
      <CromoPilulaTopo
        vista={painelAberto ? "conversa" : "grafo"}
        onVista={(v) => (v === "conversa") !== painelAberto && onAlternarPainel()}
        aberto={camadasAberto}
        onAlternar={() => onCamadas(!camadasAberto)}
        camadas={camadas}
        camadasVazio="Nenhum nó neste workflow"
        selecionado={selecionado}
        onSelecionar={localizar}
        iniciais="EU"
        onConta={() => setSettingsOpen(true)}
        /* O saldo da Kie, onde ele é gasto. Sem chave, a pílula leva aos
           Ajustes — o mesmo lugar do avatar. */
        extra={<CromoCreditos onConectar={() => setSettingsOpen(true)} />}
      />

      <CromoBarraVisualizacao
        zoom={zoom}
        onZoom={(z) => zoomTo(z, { duration: 200 })}
        onAjustar={() => fitView({ duration: 300 })}
        gruposAtalhos={ATALHOS_WORKFLOW}
      />
    </>
  );
}

"use client";

/**
 * A barra vertical de ferramentas de `/workflow/<id>`.
 *
 * Na leva 4 ela deixou de ser uma barra escura própria e passou a ser o mesmo
 * cromo do bloco 09 que veste `/projeto/<id>` — `components/cromo/`. A
 * geometria é a da referência: cápsulas de `radius 999px` com `padding 6` e
 * `gap 8`, botões de 32×32 (passo de 40), ícones de 16×16.
 *
 * O CONTRATO DE PROPS ESTÁ CONGELADO junto com quem chama: o
 * `WorkflowCanvas` (arquivo congelado) monta este componente passando
 * `activeTool`, `onToolChange`, `onAddNode`, `onUndo`, `onRedo`, `canUndo`,
 * `canRedo`, `onOpenSettings`, `onExport` e `exporting`. Nenhuma prop muda de
 * nome, some ou vira obrigatória — o que faltar se deriva do store.
 *
 * TRÊS GRUPOS, e o terceiro não existe na referência:
 *
 *   1 — criar     Selecionar · Mover · Adicionar nó · Imagem · Vídeo · Assistente
 *                 · Personagens (abre o seletor do elenco de `/personagens`)
 *   2 — painéis   Ajustes (é o que esta tela tem de verdade para abrir, e
 *                 chega pelo `onOpenSettings` que o chamador já passa)
 *   3 — nosso     Organizar · Desfazer · Refazer · Exportar
 *
 * O grupo 3 é decisão explícita do usuário: ele preferiu manter os três
 * visíveis a escondê-los em atalho e menu. Ele divide a segunda cápsula com o
 * grupo 2, separado pelo traço de 24×1px do rail da barra lateral — é o traço
 * que deixa claro que aquilo é acréscimo nosso, e não parte da referência.
 */

import { useCallback, useMemo, useState } from "react";
import {
  MousePointer2, Hand, Plus, Settings, Undo2, Redo2, Download, Network,
  ImageIcon, Film, Bot, UserRound,
} from "@/components/icones";
import PersonagemPickerMenu from "@/components/PersonagemPickerMenu";
import CromoBarraFerramentas from "@/components/cromo/CromoBarraFerramentas";
import type { CapsulaFerramentas, ItemFerramenta } from "@/components/cromo/CromoTipos";
import { criarNo, telaParaFluxo } from "@/lib/adicionarNo";
import { layoutWorkflow } from "@/lib/autoLayout";
import { useWorkflowStore } from "@/lib/store";

/**
 * Os tipos de geração que entram no grupo 1, como os contêineres da barra da
 * referência. A lista sai de `lib/nodeTypes.tsx`, e são exatamente os três com
 * `category: "generators"` — nada aqui é decorativo: cada botão cria um nó.
 *
 * Sem 3D e sem Áudio: o workflow não tem modelo para nenhum dos dois, e um
 * contêiner que não gera nada é pior do que um contêiner ausente.
 */
const TIPOS_DE_GERACAO: { tipo: string; rotulo: string; Icone: typeof Plus }[] = [
  { tipo: "generateNode", rotulo: "Imagem", Icone: ImageIcon },
  { tipo: "videoGeneratorNode", rotulo: "Vídeo", Icone: Film },
  { tipo: "assistantNode", rotulo: "Assistente", Icone: Bot },
];

type ToolId = "select" | "hand" | "cut" | "frame" | "comment";

interface CanvasToolbarProps {
  activeTool?: ToolId;
  onToolChange?: (tool: ToolId) => void;
  onAddNode?: (anchorRect: DOMRect) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenSettings?: () => void;
  onExport?: () => void;
  exporting?: boolean;
}

export default function CanvasToolbar({
  activeTool = "select",
  onToolChange,
  onAddNode,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = false,
  onOpenSettings,
  onExport,
  exporting = false,
}: CanvasToolbarProps) {
  /* O seletor de personagens é nosso: nasce da barra, sem passar pelo
     `WorkflowCanvas` congelado. Posiciona pelo DOM, como os contêineres. */
  const [personagensAnchor, setPersonagensAnchor] = useState<DOMRect | null>(null);

  const addToast = useWorkflowStore((s) => s.addToast);
  const handleOrganize = useCallback(() => {
    const arranged = layoutWorkflow();
    if (!arranged) addToast("Nada para organizar ainda", "info");
  }, [addToast]);

  const capsulas: CapsulaFerramentas[] = useMemo(
    () => [
      {
        chave: "criar",
        rotulo: "Ferramentas do canvas",
        blocos: [
          [
            {
              chave: "select",
              rotulo: "Selecionar",
              tecla: "V",
              Icone: MousePointer2,
              ativo: activeTool === "select",
              onClick: () => onToolChange?.("select"),
            },
            {
              chave: "hand",
              rotulo: "Mover",
              tecla: "H",
              Icone: Hand,
              ativo: activeTool === "hand",
              onClick: () => onToolChange?.("hand"),
            },
            {
              chave: "add",
              rotulo: "Adicionar nó",
              /* O pontinho de 3,26×3,03: este botão abre menu, e o menu quem
                 desenha é o `AddNodeMenu`, que vive dentro do ReactFlow. */
              menu: true,
              Icone: Plus,
              onClick: (caixa) => onAddNode?.(caixa),
            },
            /* Os contêineres. Sem ponto: nascem pelo posicionamento automático
               de `lib/adicionarNo.ts`, o mesmo do menu aberto pela barra —
               um botão não é uma posição no plano. */
            ...TIPOS_DE_GERACAO.map<ItemFerramenta>((t) => ({
              chave: t.tipo,
              rotulo: t.rotulo,
              Icone: t.Icone,
              onClick: () => criarNo(t.tipo, telaParaFluxo),
            })),
            {
              chave: "personagens",
              rotulo: "Personagens",
              /* Abre menu: o seletor lista o elenco e cria o nó de imagem
                 (retrato) ou de texto (descrição) com um clique. */
              menu: true,
              Icone: UserRound,
              onClick: (caixa) => setPersonagensAnchor((atual) => (atual ? null : caixa)),
            },
          ],
        ],
      },
      {
        chave: "paineis",
        rotulo: "Painéis e histórico",
        blocos: [
          [
            {
              chave: "ajustes",
              rotulo: "Ajustes",
              Icone: Settings,
              /* `onOpenSettings` é passado pelo chamador congelado e não ia a
                 lugar nenhum antes desta leva. Agora vai. */
              onClick: () => onOpenSettings?.(),
            },
          ],
          /* ── daqui para baixo é acréscimo nosso, marcado pelo traço ── */
          [
            {
              chave: "organizar",
              rotulo: "Organizar nós",
              Icone: Network,
              onClick: handleOrganize,
            },
            {
              chave: "undo",
              rotulo: "Desfazer",
              tecla: "Ctrl Z",
              Icone: Undo2,
              desabilitado: !canUndo,
              motivo: "Nada para desfazer",
              onClick: () => onUndo?.(),
            },
            {
              chave: "redo",
              rotulo: "Refazer",
              tecla: "Ctrl ⇧ Z",
              Icone: Redo2,
              desabilitado: !canRedo,
              motivo: "Nada para refazer",
              onClick: () => onRedo?.(),
            },
            {
              chave: "export",
              rotulo: exporting ? "Exportando…" : "Exportar (.zip)",
              Icone: Download,
              desabilitado: exporting,
              motivo: "Exportando…",
              onClick: () => onExport?.(),
            },
          ],
        ],
      },
    ],
    [activeTool, onToolChange, onAddNode, onOpenSettings, onUndo, onRedo, canUndo, canRedo, onExport, exporting, handleOrganize],
  );

  return (
    <>
      <CromoBarraFerramentas capsulas={capsulas} />
      {personagensAnchor && (
        <PersonagemPickerMenu
          anchorRect={personagensAnchor}
          onClose={() => setPersonagensAnchor(null)}
          onCriarNo={(tipo, dados) => criarNo(tipo, telaParaFluxo, { dados })}
        />
      )}
    </>
  );
}

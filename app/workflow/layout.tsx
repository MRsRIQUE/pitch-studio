"use client";

/**
 * A TELA ÚNICA: o painel de chat sobre o grafo de verdade.
 *
 * Arquivo novo desde a leva 4, e é ele que torna tudo isso possível sem
 * descongelar nada: `components/WorkflowCanvas.tsx`, `components/nodes/`,
 * `components/edges/`, `app/workflow/page.tsx` e `app/workflow/[id]/page.tsx`
 * continuam byte a byte como estavam. O que este layout faz é sobrepor.
 *
 * Quatro coisas acontecem aqui:
 *
 * 1. O `ReactFlowProvider` sobe UM NÍVEL. O `<ReactFlow>` do canvas congelado
 *    cria um provider implícito quando não encontra um; encontrando o nosso,
 *    ele se junta a este. É o que dá à barra do rodapé acesso a
 *    `useViewport`/`useReactFlow` sem uma linha dentro do arquivo congelado.
 *
 * 2. O **painel de chat** entra por cima, na faixa de 368px com `inset 8px`.
 *    Ele é reusado inteiro de `components/projeto/PainelChat.tsx` — a metade
 *    que sobreviveu quando o canvas de blocos foi aposentado na leva 7.
 *
 * 3. O cromo só entra em `/workflow/<id>`. Em `/workflow` — que é a LISTA de
 *    cards, não um canvas — o layout devolve os filhos crus: sem provider,
 *    sem painel, sem pílula, sem barra de rodapé.
 *
 * 4. `data-painel` sai de `painelAberto`, e é ele que faz a barra vertical
 *    deslizar de 388 para 12 em `.2s`. Desde a leva 4 essa transição existia
 *    e nunca acontecia, porque esta tela não tinha painel para recolher.
 *
 * A `.pitch-night` saiu na leva 9: o canvas passou ao claro, e com ele o
 * `--hover-brand` volta a ser o violeta da marca. A única tela escura do app
 * é a Memória, que não usa nada daqui.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/store";
import { useProjetoSessao } from "@/lib/projetoSessao";
import { PainelChat } from "@/components/projeto/PainelChat";
import CromoWorkflow from "@/components/cromo/CromoWorkflow";
import CromoMenuCursor from "@/components/cromo/CromoMenuCursor";
import { useGaleriaSessao } from "@/lib/galeriaSessao";
import { GaleriaProjeto } from "@/components/inspiracao/GaleriaProjeto";

/** `/workflow/<id>` sim; `/workflow` e `/workflow/<id>/<algo>` não. */
function idDaRota(pathname: string): string | null {
  const m = /^\/workflow\/([^/]+)$/.exec(pathname);
  return m ? m[1] : null;
}

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const projetoId = idDaRota(pathname);

  return projetoId ? <TelaUnica projetoId={projetoId}>{children}</TelaUnica> : <>{children}</>;
}

/**
 * Componente à parte por duas razões: a lista não paga os hooks da tela de
 * canvas, e hook não pode ficar depois de um `return` condicional.
 */
function TelaUnica({ projetoId, children }: { projetoId: string; children: React.ReactNode }) {
  const [camadasAberto, setCamadasAberto] = useState(false);

  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const painelAberto = useProjetoSessao((e) => e.painelAberto);
  const alternarPainel = useProjetoSessao((e) => e.alternarPainel);
  const garantir = useProjetoSessao((e) => e.garantir);
  const nomeDoEspaco = useWorkflowStore((s) => s.spaces.find((sp) => sp.id === projetoId)?.name);

  /* A galeria é a quarta superfície desta tela, à direita. A raiz precisa
     saber duas coisas dela: se está aberta e quanto ela mede — é com esses
     dois números que a pílula do topo e a barra do rodapé recuam em vez de
     ficarem por baixo do painel. Ver `components/inspiracao/galeria-projeto.css`. */
  const galeriaAberta = useGaleriaSessao((e) => e.aberta);
  const galeriaLargura = useGaleriaSessao((e) => e.largura);

  /* A gaveta da conversa nasce com o nome do projeto. Isso rodava no
     `PainelProjeto`, aposentado junto com o canvas de blocos; a
     responsabilidade veio para cá com a montagem do painel. */
  useEffect(() => {
    garantir(projetoId, nomeDoEspaco ?? "Sem título");
  }, [projetoId, nomeDoEspaco, garantir]);

  /* Seleção não sobrevive a um recarregamento — mas estava sobrevivendo.
     `addNode` marca o nó novo com `selected: true` e o `syncSpace` grava isso
     no `space`; na volta, o canvas congelado vê "alguém selecionado" e
     esmaece TODO o resto para `opacity: .25`. O grafo abria apagado atrás do
     painel. Limpo ao entrar no projeto: é estado de interface, não conteúdo.
     A causa está em `lib/store.ts`, que não é meu — ver o relatório. */
  useEffect(() => {
    const marcados = useWorkflowStore
      .getState()
      .nodes.filter((n) => n.selected)
      .map((n) => ({ type: "select" as const, id: n.id, selected: false }));
    if (marcados.length > 0) onNodesChange(marcados);
  }, [projetoId, onNodesChange]);

  return (
    <ReactFlowProvider>
      <div
        className="cr-root cr-root--workflow"
        /* A barra vertical fica em 388 com o painel aberto e desliza para 12
           quando ele recolhe — a transição de `.2s` da referência. */
        data-painel={painelAberto ? "aberto" : "colapsado"}
        data-camadas={camadasAberto ? "aberto" : "fechado"}
        data-galeria={galeriaAberta ? "aberta" : "fechada"}
        style={{ "--gal-largura": `${galeriaLargura}px` } as React.CSSProperties}
      >
        {children}

        {/* O painel de chat, sobre o grafo. O invólucro existe porque as
            regras do composer em `painel.css` são escopadas em `.pj-raiz`;
            `--sobre-grafo` desfaz o que aquele shell fazia como página
            inteira (fundo claro, caixa de layout) e deixa só a geometria. */}
        <div className="pj-raiz pj-raiz--sobre-grafo">
          <PainelChat projetoId={projetoId} />
        </div>

        <CromoWorkflow
          camadasAberto={camadasAberto}
          onCamadas={setCamadasAberto}
          painelAberto={painelAberto}
          onAlternarPainel={alternarPainel}
        />
        {/* O botão direito no pane abre o menu de adicionar, ancorado no cursor. */}
        <CromoMenuCursor />

        {/* A galeria, à direita — a posição que ela tem na referência do
            BoardUI: painel ao lado da conversa. Entra depois do cromo porque
            é ele quem ela empurra, não o contrário. */}
        <GaleriaProjeto />
      </div>
    </ReactFlowProvider>
  );
}

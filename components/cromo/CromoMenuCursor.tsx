"use client";

/**
 * O menu do botão direito no canvas de workflow.
 *
 * Vive fora do `<ReactFlow>` e ouve `contextmenu` no `.react-flow__pane` — o
 * painel de fundo, não os nós: clicar com o direito num nó continua sendo do
 * nó. `preventDefault()` tira o menu do navegador e a posição do cursor vira
 * um `DOMRect` de **1×1**, que é o combinado com o `AddNodeMenu`: retângulo
 * sem área não é um botão, é um ponto, e o nó nasce ali.
 *
 * Nada de disparar o botão da barra por código: ele ancora na barra, e o nó
 * nasceria a 80px da borda esquerda em vez de onde se clicou.
 *
 * O `AddNodeMenu` não é congelado, mas quem o chama é (`WorkflowCanvas`, para
 * o botão `+` da barra). A assinatura não mudou: ele continua recebendo só
 * `anchorRect` e `onClose`, e resolve sozinho posição e criação.
 */

import { useEffect, useState } from "react";
import AddNodeMenu from "@/components/AddNodeMenu";

export default function CromoMenuCursor() {
  const [ancora, setAncora] = useState<DOMRect | null>(null);

  useEffect(() => {
    const aoMenu = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      /* Só o pane. Num nó, numa aresta ou nas barras flutuantes, o menu do
         navegador (ou o do próprio elemento) continua valendo. */
      if (!alvo?.classList.contains("react-flow__pane")) return;
      e.preventDefault();
      setAncora(new DOMRect(e.clientX, e.clientY, 1, 1));
    };
    document.addEventListener("contextmenu", aoMenu);
    return () => document.removeEventListener("contextmenu", aoMenu);
  }, []);

  if (!ancora) return null;
  return <AddNodeMenu anchorRect={ancora} onClose={() => setAncora(null)} />;
}

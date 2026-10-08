/* ============================================================
   O vocabulário do cromo do bloco 09

   Duas telas usam as mesmas três peças: `/projeto/<id>` (o plano de blocos,
   leva 3) e `/workflow/<id>` (o grafo do `@xyflow/react`, leva 4). O que
   muda entre elas é o CONTEÚDO e os CALLBACKS — a geometria é a mesma.

   Nada aqui sabe qual das duas telas está montada, e é de propósito: foi o
   acoplamento entre peça e tela que fez a leva 2 quebrar.
   ============================================================ */

import type { ComponentType, SVGProps } from "react";

/** A assinatura que `@/components/icones` expõe. */
export type Icone = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

/* ------------------------------------------------------------------ */
/* Barra vertical de ferramentas                                       */
/* ------------------------------------------------------------------ */

export interface ItemFerramenta {
  chave: string;
  /** Vai para a tooltip escura à direita e para o `aria-label`. */
  rotulo: string;
  /** A tecla aparece na MESMA tooltip do rótulo, como na referência. */
  tecla?: string;
  Icone: Icone;
  ativo?: boolean;
  desabilitado?: boolean;
  /** Motivo do desabilitado, para o `title` nativo. */
  motivo?: string;
  /** Desenha o retângulo de 3,26×3,03 no canto: o botão abre menu. */
  menu?: boolean;
  /** Recebe a caixa do botão, para quem precisa ancorar um menu. */
  onClick: (caixa: DOMRect) => void;
}

/**
 * Uma cápsula branca de `radius 999px`. Os `blocos` são subgrupos dentro da
 * MESMA cápsula, separados pelo traço de 24×1px do rail — é assim que o
 * nosso grupo de Desfazer/Refazer/Exportar se distingue dos que a
 * referência tem, sem virar uma terceira cápsula solta.
 */
export interface CapsulaFerramentas {
  chave: string;
  rotulo: string;
  blocos: ItemFerramenta[][];
}

/* ------------------------------------------------------------------ */
/* Pílula do canto superior direito                                    */
/* ------------------------------------------------------------------ */

/**
 * As duas vistas do MESMO projeto: `conversa` é `/projeto/<id>` (chat mais
 * artefatos no plano) e `grafo` é `/workflow/<id>` (o editor de nós). O
 * conteúdo das duas é o mesmo `space` do `lib/store.ts`.
 */
export type Vista = "conversa" | "grafo";

/** Uma linha da lista de Camadas: o que a tela tem de empilhado. */
export interface ItemCamada {
  id: string;
  rotulo: string;
  /** À direita da linha, em cinza: tamanho, tipo, o que a tela quiser. */
  detalhe?: string;
  Icone?: Icone;
}

/** O seletor de página. Ausente quando a tela não tem páginas. */
export interface Paginas {
  lista: { numero: number; rotulo: string }[];
  atual: number;
  onTrocar: (numero: number) => void;
  onNova?: () => void;
}

/* ------------------------------------------------------------------ */
/* Barra de visualização do rodapé                                     */
/* ------------------------------------------------------------------ */

/** Um grupo do painel de atalhos. `coluna` porque a referência agrupa por
 *  assunto, não em ziguezague. */
export interface GrupoAtalhos {
  titulo: string;
  coluna: 0 | 1 | 2;
  itens: { acao: string; teclas: string[] }[];
}

/** Os quatro fundos do seletor da referência. */
export const FUNDOS_CANVAS = ["#f5f5f5", "#ffffff", "#ebebeb", "#1a1a1a"] as const;

/** Acima deste ponto o fundo é claro. Só o `#1a1a1a` da lista cai abaixo. */
export function fundoEscuro(cor: string): boolean {
  const hex = cor.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  /* Luminância relativa aproximada: o suficiente para escolher entre a
     paleta clara e a noturna, que é a única decisão que depende disso. */
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

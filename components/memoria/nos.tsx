"use client";

/* ============================================================
   OS NÓS E A ARESTA

   Geometria literal da tabela do `INFO.md`: núcleo 128×128 com
   raio `ms-xl`, satélite 110×110 circular, âncora
   `rounded-ms-lg px-3 py-2.5` entre 120 e 400 de largura.

   Os `strokeWidth` fracionários (1.4181818… · 1.95 · 2) são o
   `absoluteStrokeWidth` do lucide fixando o traço em 1,3px
   independentemente do tamanho do ícone — 1.3 × 24 / tamanho.
   Vale copiar o número, não arredondar.
   ============================================================ */

import * as React from "react";
import { Handle, Position, type EdgeProps, type NodeProps } from "@xyflow/react";
import { Folder, FolderKanban, Images, MessageSquare, Plus } from "@/components/icones";
import { NucleoChip } from "./NucleoChip";
import type { OrigemId } from "./dados";

/** 1,3px de traço num ícone de 22px, como no DOM da referência. */
const TRACO_22 = (1.3 * 24) / 22;

/* Os ícones seguem o CONTEÚDO, que é a terceira licença: a
   referência põe `folder-kanban` no slot da direita e é o mesmo que
   usamos para Projetos, mas `message-square-warning` no nó que aqui
   é Pastas seria um defeito de leitura, não fidelidade. Tamanho,
   traço e biblioteca continuam os dela. */
const ICONES: Record<OrigemId, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  geracoes: Images,
  conversas: MessageSquare,
  projetos: FolderKanban,
  pastas: Folder,
};

/* Quatro âncoras invisíveis por nó. O xyflow precisa delas para
   resolver a aresta; qual lado usar é escolhido pelo mesmo critério
   de |dx| × |dy| da referência, no montador do grafo. */
const LADOS = [
  [Position.Top, "top"],
  [Position.Right, "right"],
  [Position.Bottom, "bottom"],
  [Position.Left, "left"],
] as const;

function Ancoras() {
  return (
    <>
      {(["source", "target"] as const).map(tipo =>
        LADOS.map(([pos, id]) => (
          <Handle
            key={`${tipo}-${id}`}
            type={tipo}
            position={pos}
            id={`${tipo}-${id}`}
            isConnectable={false}
          />
        )),
      )}
    </>
  );
}

/* ── Núcleo ─────────────────────────────────────────────────
   `relative overflow-hidden rounded-ms-xl`, 128×128, fundo
   `--ms-bg`, 1px de `--ms-ring` e a pilha de cinco sombras. */
export function NoNucleo() {
  return (
    <div className="mem-nucleo mem-r-xl">
      <NucleoChip />
      <Ancoras />
    </div>
  );
}

/* ── Satélite ───────────────────────────────────────────────
   Clicar seleciona, como na referência: a seleção mantém o rastro
   aceso e revela o "+ Adicionar". Quem navega é a âncora — que é o
   nó que o mapa nomeia (pasta, projeto, conversa, geração). */
export type DadosOrigem = {
  origem: OrigemId;
  rotulo: string;
  total: number | null;
  memoriaLigada: boolean;
  formAberta: boolean;
};

export function NoOrigem({ data }: NodeProps & { data: DadosOrigem }) {
  const Icone = ICONES[data.origem];
  return (
    <div className="mem-satelite-grupo">
      <div className="mem-satelite">
        <Icone size={22} strokeWidth={TRACO_22} />
        <span className="mem-satelite-rotulo">{data.rotulo}</span>
        {/* Enquanto a contagem não voltou da API mostramos "—": um
            zero aqui diria que o acervo está vazio. */}
        <span className="mem-satelite-contador">{data.total ?? "—"}</span>
      </div>

      {/* Com a memória desligada — ou com o cartão de criação aberto —
          o botão sai do DOM, como o `d && !k && <button>` da
          referência: ele não fica escondido, ele deixa de existir.

          Sem `onClick` próprio de propósito: quem trata o clique é o
          `onNodeClick` do grafo, olhando este `data-adicionar`. Assim
          o cálculo da posição do cartão fica num manipulador de
          evento, e nenhum callback com estado mutável precisa
          atravessar o `data` do nó a cada render. */}
      {data.memoriaLigada && !data.formAberta && (
        <button type="button" className="mem-adicionar" data-adicionar={data.origem}>
          <Plus size={15} strokeWidth={2} />
          <span>Adicionar</span>
        </button>
      )}

      <Ancoras />
    </div>
  );
}

/* ── Âncora ─────────────────────────────────────────────────
   Onde a referência pendura a memória salva, penduramos o item
   real. É este nó que navega. */
export type DadosAncora = {
  rotulo: string;
  detalhe?: string;
  /** Imagem anexada no cartão de criação, guardada com o registro. */
  miniatura?: string;
  aoAbrir: () => void;
};

export function NoAncora({ data }: NodeProps & { data: DadosAncora }) {
  return (
    <>
      <button
        type="button"
        className="mem-ancora mem-r-lg"
        data-com-imagem={data.miniatura ? "1" : "0"}
        title={data.rotulo}
        onClick={event => { event.stopPropagation(); data.aoAbrir(); }}
      >
        {data.miniatura && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mem-ancora-miniatura" src={data.miniatura} alt="" loading="lazy" />
        )}
        <span className="mem-ancora-texto">
          {data.rotulo}
          {data.detalhe && <span className="mem-ancora-detalhe">{data.detalhe}</span>}
        </span>
      </button>
      <Ancoras />
    </>
  );
}

/* ── Aresta ─────────────────────────────────────────────────
   O `d` vem pronto do montador: para as quatro arestas do núcleo
   ele é o literal do snapshot da referência, com as 17 casas
   decimais que o `getBezierPath` dela produziu; para as âncoras é
   o mesmo `getBezierPath` com `curvature .25`.

   O segundo path, invisível e de 20px, é a área de clique — está
   no DOM da referência e some se a gente só copiar o visível. */
export function ArestaLiteral({ id, data }: EdgeProps) {
  const d = (data as { d?: string } | undefined)?.d ?? "";
  return (
    <>
      <path
        id={id}
        d={d}
        fill="none"
        className="react-flow__edge-path"
        style={{ stroke: "var(--ms-border-strong)", strokeWidth: 1.5, strokeLinecap: "round", opacity: 0.6 }}
      />
      <path d={d} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />
    </>
  );
}

"use client";

/* ============================================================
   O HERÓI DA CRIAR — `home-v2-hero-legacy`

   A faixa de 996×170 que fica acima do composer: as abas à esquerda,
   ocupando a sobra, e a área de 220×170 do mascote à direita, com 60px
   de margem. É a mesma linha que põe a tablist em 692 — `996 − 24 (gap)
   − 220 − 60`.

   Duas trocas de conteúdo, das que a licença 3 permite:

   1. O mascote da referência são CINCO vídeos em `static.d.gtimg.com`,
      um por categoria, com alfa. É IP da Tencent, e o mapa já resolve
      isso no bloco 08: no lugar dele vai o orbe da SELLA, a assistente
      do SaySell (`components/sella`) — os olhos seguem o mouse e o
      clique dá um pulinho.

   2. As cinco pílulas da referência são decoração — `pointer-events:
      none` — e só trocam de rótulo ao mudar de categoria. Aqui elas SÃO
      as cinco categorias, e clicar numa liga a correspondente. As
      posições, os tamanhos e as opacidades continuam os literais do
      `index-C4HxBoRo.js`; o que muda é que elas recebem o clique.

   As posições saem do quadro de projeto de 845×175 do bundle,
   convertidas contra a caixa `te = {left: 549.25, top: 3, width: 219.7,
   height: 210}`:

       {left:725, top:10,  width:53, opacity:.3}
       {left:754, top:46,  width:58, opacity:1}
       {left:647, top:23,  width:55, opacity:.5}
       {left:708, top:82,  width:84, opacity:1}
       {left:761, top:118, width:68, opacity:.7}

   `(725 − 549.25) / 219.7 = 79,9954%` — o número que está no `page.html`.
   ============================================================ */

import * as React from "react";
import { SellaOrb } from "@/components/sella/SellaOrb";
import { CATEGORIAS, type CategoriaId } from "@/lib/categoriaComposer";
import { CategoriaAbas } from "./CategoriaAbas";
import "@/app/gallery/composer.css";

/* As cinco posições, na ordem em que o bundle as declara. Cada uma
   recebe uma categoria, na ordem das abas. */
const POSICOES = [
  { left: "79.9954%", top: "3.33333%",  width: "24.1238%", opacity: 0.3 },
  { left: "93.1953%", top: "20.4762%",  width: "26.3996%", opacity: 1   },
  { left: "44.4925%", top: "9.52381%",  width: "25.0341%", opacity: 0.5 },
  { left: "72.2576%", top: "37.619%",   width: "38.234%",  opacity: 1   },
  { left: "96.3814%", top: "54.7619%",  width: "30.9513%", opacity: 0.7 },
] as const;

export function HeroCriar({
  valor,
  onChange,
}: {
  valor: CategoriaId | null;
  onChange: (v: CategoriaId | null) => void;
}) {
  const [toques, setToques] = React.useState(0);
  return (
    <div className="pcx-heroi">
      <CategoriaAbas valor={valor} onChange={onChange} />

      <div className="pcx-heroi-previa">
        <div className="pcx-heroi-mascote">
          {/* A SELLA no lugar do antigo mascote: os olhos seguem o mouse e o
              clique dá um pulinho. */}
          <button
            type="button"
            className="pcx-heroi-sella"
            aria-label="SELLA, a assistente do SaySell"
            onClick={() => setToques((n) => n + 1)}
          >
            <SellaOrb size={108} seguirMouse reagir={toques} />
          </button>
        </div>

        <div className="pcx-heroi-tags">
          {CATEGORIAS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="pcx-heroi-tag"
              data-ativa={valor === c.id ? "true" : undefined}
              /* A opacidade literal vai numa custom property, não em
                 `opacity` direto: assim o `:hover` do CSS ainda a vence,
                 sem precisar de `!important` contra o estilo em linha. */
              style={{
                left: POSICOES[i].left,
                top: POSICOES[i].top,
                width: POSICOES[i].width,
                "--pcx-tag-op": valor === c.id ? 1 : POSICOES[i].opacity,
              } as React.CSSProperties}
              aria-pressed={valor === c.id}
              onClick={() => onChange(valor === c.id ? null : c.id)}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

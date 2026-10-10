"use client";

/* ============================================================
   A BARRA DE STATUS — os 28px acima do composer

   `Pensando…`, `Gerando imagem com …`. O texto recebe a onda de luz de
   3 s por `background-clip: text` — é a segunda das duas keyframes
   próprias do bloco (a outra é o shimmer do placeholder, de 1,5 s).

   A barra some quando não há status: `:not(:empty)` na referência, aqui
   um `null`. Ela não ocupa lugar quando não existe.

   Na referência o mascote da esquerda é um asset largo de 52×43 que
   transborda para baixo da barra; o recorte disponível era o quadrado
   de 32, e o próprio preview reduziu a caixa para 20 para cair no mesmo
   x medido. Aqui é a marca, na mesma caixa de 20.
   ============================================================ */

import { SaySellMark } from "@/components/SaySellLogo";
import "@/components/projeto/painel.css";

export function PainelStatus({ texto }: { texto: string }) {
  if (!texto) return null;

  return (
    <div className="pj-status" role="status" aria-live="polite">
      <span className="pj-status-marca" aria-hidden>
        <SaySellMark size={20} />
      </span>
      <span className="pj-status-texto">{texto}</span>
    </div>
  );
}

"use client";

/* ============================================================
   A BARRA DE STATUS — a onda de luz acima do campo

   `chat-input-loading-bar` é literal do `css-chat-DMGarjTu.css`: 28px de altura,
   28px de recuo à esquerda para o mascote, e o texto varrido por um degradê de
   3s com `background-clip:text`.

   O slot fica no painel (que é do Tecla); este componente é só o conteúdo, para
   que o texto e a animação sejam os mesmos venha o status de onde vier.
   Quando não há status, não renderiza nada — o `:not(:empty)` do CSS conta com
   isso para não empurrar o composer 5px para cima à toa.
   ============================================================ */

import { Sparkles } from "@/components/icones";
import "./ciclo.css";

export function CicloStatus({ texto }: { texto?: string | null }) {
  if (!texto) return null;

  return (
    <div className="chat-input-loading-bar">
      {/* No original é o mascote de 52×43 transbordando para fora da barra; o
          nosso é a marca, que é quadrada — a caixa cai para 20px e centra. */}
      <span className="chat-input-loading-mascot" aria-hidden>
        <Sparkles size={14} />
      </span>
      <span className="chat-input-loading-text">{texto}</span>
    </div>
  );
}

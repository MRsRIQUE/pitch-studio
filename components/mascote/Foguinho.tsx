"use client";

/* ============================================================
   O FOGUINHO — o mascote do Pitch AI

   Duas folhas 3×3 (nove direções da cabeça, nove reações) e o
   componente `Mascot` do page-mascot (MIT, licença ao lado). O mouse
   vira a cabeça; o clique pisca e reage; quatro cliques rápidos deixam
   ele tonto. As folhas ficam em `public/mascots`.
   ============================================================ */

import { Mascot } from "./Mascot";

export interface PropsFoguinho {
  size?: number;
  className?: string;
  /** Raio em px em que ele olha para a frente. */
  deadZone?: number;
  /** Sem botão próprio, para morar dentro de outro botão. */
  decorativo?: boolean;
  /** Cada mudança do número toca uma reação. */
  reagir?: number;
}

export function Foguinho({ size = 180, ...resto }: PropsFoguinho) {
  return (
    <Mascot
      directions="/mascots/foguinho-directions.webp"
      reactions="/mascots/foguinho-reactions.webp"
      size={size}
      label="Foguinho do SaySell Studio"
      {...resto}
    />
  );
}

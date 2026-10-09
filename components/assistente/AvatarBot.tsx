"use client";

/* ============================================================
   O AVATAR DO ASSISTENTE

   Desenho nosso, em SVG puro. O que veio do estúdio que o usuário mandou olhar
   (`avatars.bible-strong.app`) é só o **comportamento**, que eu medi na tela
   deles e está anotado abaixo — a técnica (SVG, sem canvas, sem WebGL, sem
   biblioteca de animação) e os tempos da piscada. Nenhum traço do desenho
   deles foi copiado: os presets são bolhas redondas com olhos escuros; este
   aqui é um quadrado de canto redondo com a tinta da marca e olhos claros,
   irmão do `SaySellMark`.

   Os três tempos, literais do painel "ANIMATION DETAILS" deles:

     primeira piscada   4,8 s depois de montar
     intervalo          6,5 s a 9,5 s, sorteado a cada volta
     duração            420 ms, fechar e abrir

   O intervalo é sorteado, e é por isso que o agendamento fica no JavaScript:
   `animation-delay` do CSS é um valor fixo, então uma piscada em cadência
   aleatória não sai de `@keyframes` sozinha. O que o JS faz é só trocar uma
   classe; quem anima os 420 ms é o CSS.

   Com `prefers-reduced-motion` o avatar para no `idle` e não pisca — o
   agendador nem chega a ser criado.
   ============================================================ */

import * as React from "react";
import "./avatar.css";

/** Os três estados que o nosso assistente sabe distinguir de verdade. */
export type EstadoAvatar = "idle" | "listening" | "thinking";

export interface PropsAvatar {
  estado?: EstadoAvatar;
  /** Lado do quadrado, em px. */
  size?: number;
  className?: string;
}

/* Os tempos medidos. Ficam nomeados para o relatório e o código dizerem o
   mesmo número. */
export const PISCADA = {
  primeiraEm: 4800,
  intervaloMin: 6500,
  intervaloMax: 9500,
  duracao: 420,
} as const;

export function AvatarBot({ estado = "idle", size = 22, className }: PropsAvatar) {
  const [piscando, setPiscando] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let t: ReturnType<typeof setTimeout>;
    let fim: ReturnType<typeof setTimeout>;

    const piscar = () => {
      setPiscando(true);
      fim = setTimeout(() => {
        setPiscando(false);
        t = setTimeout(piscar, sortear());
      }, PISCADA.duracao);
    };
    const sortear = () =>
      PISCADA.intervaloMin + Math.random() * (PISCADA.intervaloMax - PISCADA.intervaloMin);

    t = setTimeout(piscar, PISCADA.primeiraEm);
    return () => {
      clearTimeout(t);
      clearTimeout(fim);
    };
  }, []);

  /* O id do gradiente precisa ser único: dois avatares na mesma página
     compartilhariam a definição e o segundo herdaria a do primeiro. */
  const id = React.useId().replace(/:/g, "");

  return (
    <svg
      className={`ava${piscando ? " ava--piscando" : ""} ava--${estado}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Assistente"
    >
      <defs>
        {/* O gradiente 135° do kit, pelos tokens — nada de hex aqui. */}
        <linearGradient id={`ava-g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-light)" />
          <stop offset="100%" stopColor="var(--brand-solid)" />
        </linearGradient>
      </defs>

      {/* A cabeça: quadrado de canto redondo, a mesma família do SaySellMark. */}
      <rect className="ava__cabeca" x="2" y="3" width="20" height="18" rx="6" fill={`url(#ava-g-${id})`} />

      {/* O anel de escuta: só aparece em `listening`, pulsando. */}
      <rect className="ava__anel" x="2" y="3" width="20" height="18" rx="6" fill="none" strokeWidth="1.5" />

      {/* Os olhos. Duas peças claras; a piscada fecha as duas ao mesmo tempo,
          e o `thinking` as desloca de lado, devagar. */}
      <g className="ava__olhos">
        <rect className="ava__olho" x="7.6" y="9.4" width="2.8" height="5.2" rx="1.4" />
        <rect className="ava__olho" x="13.6" y="9.4" width="2.8" height="5.2" rx="1.4" />
      </g>
    </svg>
  );
}

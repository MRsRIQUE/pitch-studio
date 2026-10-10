"use client";

/* ============================================================
   ORBE DA SELLA — a identidade da assistente do SaySell no Studio

   Porta em CSS puro do avatar da SELLA do site (saysell-web,
   `SellaMiniOrb` + `sella.css`): miolo azulado, aro azul e ciano,
   olhos que piscam e a boca de ondas quando ela fala. Sem WebGL nem
   anime.js — cabe em qualquer tamanho e em vários lugares da tela.

   Tudo é medido em `--u` (1/26 do diâmetro, o tamanho original), então
   o mesmo desenho serve de 20px no cabeçalho a 150px na tela Criar.
   ============================================================ */

import { useEffect, useRef } from "react";
import "./sella-orb.css";

export type EstadoSella = "observando" | "pensando" | "falando";

const PULO: Keyframe[] = [
  { transform: "scale(1, 1)" },
  { transform: "scale(1.1, 0.88) translateY(4%)", offset: 0.25 },
  { transform: "scale(0.95, 1.08) translateY(-8%)", offset: 0.55 },
  { transform: "scale(1, 1)" },
];

export function SellaOrb({
  size = 26,
  estado = "observando",
  seguirMouse = false,
  reagir,
  className,
}: {
  size?: number;
  estado?: EstadoSella;
  /** Os olhos acompanham o ponteiro quando ele passa perto. */
  seguirMouse?: boolean;
  /** Cada mudança do número dá um pulinho (clique, abrir o painel). */
  reagir?: number;
  className?: string;
}) {
  const raiz = useRef<HTMLSpanElement>(null);
  const olhos = useRef<HTMLSpanElement>(null);
  const primeira = useRef(true);

  // O pulinho é uma animação do próprio nó (Web Animations), por cima da
  // respiração do CSS; a primeira passada só registra o valor inicial.
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (reagir === undefined || !raiz.current?.animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pulo = raiz.current.animate(PULO, { duration: 520, easing: "cubic-bezier(.3,1.6,.5,1)" });
    return () => pulo.cancel();
  }, [reagir]);

  useEffect(() => {
    if (!seguirMouse || estado !== "observando") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = olhos.current;
    let quadro = 0;
    const seguir = (event: PointerEvent) => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => {
        const alvo = raiz.current;
        if (!alvo || !el) return;
        const caixa = alvo.getBoundingClientRect();
        const dx = event.clientX - (caixa.left + caixa.width / 2);
        const dy = event.clientY - (caixa.top + caixa.height / 2);
        const d = Math.hypot(dx, dy);
        if (d === 0) return;
        // Até ~1/8 do diâmetro, mais forte quanto mais longe (até 600px).
        const k = (Math.min(1, d / 600) * caixa.width) / 8;
        el.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
      });
    };
    document.addEventListener("pointermove", seguir, { passive: true });
    return () => {
      window.cancelAnimationFrame(quadro);
      document.removeEventListener("pointermove", seguir);
      if (el) el.style.transform = "";
    };
  }, [seguirMouse, estado]);

  return (
    <span
      ref={raiz}
      className={["sella-orb", className].filter(Boolean).join(" ")}
      data-estado={estado}
      style={{ ["--u" as string]: `${size / 26}px`, width: size, height: size }}
      aria-hidden="true"
    >
      {estado === "pensando" ? <span className="sella-orb__halo" /> : null}
      <span className="sella-orb__core" />
      <span className="sella-orb__olhos" ref={olhos}>
        <span className="sella-orb__palpebras">
          <i />
          <i />
        </span>
      </span>
      <span className="sella-orb__boca">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

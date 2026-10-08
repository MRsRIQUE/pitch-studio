"use client";

/* ============================================================
   GYRO — a nota do loop de carregamento, em canvas 2D

   A nota grava um `Skia.Picture` por quadro e o desenha num `<Canvas>` do
   react-native-skia, ao lado de uma pílula com o rótulo. O equivalente na web
   é um `<canvas>` 2D: as contas são as mesmas (estão em `gyro.ts`, JavaScript
   nos dois lados) e o `drawCircle` do Skia vira `arc()`.

   **Por que canvas 2D e não CSS.** São 158 pontos que mudam de posição, de
   raio e de opacidade a cada quadro, e cuja ordem de pintura é reordenada por
   profundidade. Em CSS isso seria 158 elementos com `transform` e `opacity`
   recalculados no JS de qualquer jeito — o mesmo trabalho, com 158 nós no DOM
   por cima. A opção CSS que o enunciado abre serve para um loop de 3 ou 4
   peças; este não é o caso.

   O tempo vem de `performance.now()`, não do contador de quadros: assim o
   período de 6,2s é 6,2s independentemente da taxa de atualização da tela.
   ============================================================ */

import * as React from "react";
import { NOTA, acentoDaMarca, fase, pontosDoGyro } from "./gyro";
import "./notas.css";

export interface PropsGyro {
  /** O rótulo ao lado da bola. O padrão é o literal da nota. */
  rotulo?: string;
  /** Mostra a pílula em volta (`SHOWS_PILL` da nota). */
  comPilula?: boolean;
  /** Mostra o rótulo (`SHOWS_LABEL` da nota). */
  comRotulo?: boolean;
  /** Cor do anel do meio. O padrão é o violeta da marca, por decisão do
      usuário — a laranja da nota saiu; desenho e tempos ficaram iguais. */
  acento?: string;
  /** Congela o loop num instante de [0,1) — para conferir quadro a quadro. */
  faseFixa?: number;
  className?: string;
}

export function GyroLoop({
  rotulo = NOTA.rotulo,
  comPilula = true,
  comRotulo = true,
  acento,
  faseFixa,
  className,
}: PropsGyro) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const acentoRef = React.useRef(acento ?? acentoDaMarca());
  const fixaRef = React.useRef(faseFixa);

  /* Os valores vivos são lidos de dentro do laço de animação, que não
     re-renderiza: mudá-los não pode recriar o contexto. A cópia acontece em
     efeito, não no render — escrever numa ref durante o render é justamente o
     que quebra o modo concorrente do React. */
  React.useEffect(() => {
    acentoRef.current = acento ?? acentoDaMarca();
    fixaRef.current = faseFixa;
  }, [acento, faseFixa]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const S = NOTA.bola;
    /* O buffer segue a densidade da tela para os pontos não saírem serrilhados;
       o `scale` devolve o desenho ao sistema de coordenadas da nota, em que a
       caixa tem 46 de lado. Nenhum número da geometria muda com isto. */
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(S * dpr);
    canvas.height = Math.round(S * dpr);

    /* Com `prefers-reduced-motion` a nota congela: o loop para no instante 0 e
       fica legível como figura, em vez de girar. */
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const t0 = performance.now();
    let anim = 0;

    const pintar = () => {
      const t = fixaRef.current ?? (semMovimento ? 0 : fase((performance.now() - t0) / 1000));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      for (const p of pontosDoGyro(t)) {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.acento ? acentoRef.current : NOTA.ponto;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (semMovimento && fixaRef.current === undefined) return;
      anim = requestAnimationFrame(pintar);
    };
    anim = requestAnimationFrame(pintar);

    return () => cancelAnimationFrame(anim);
  }, []);

  const bola = (
    <canvas
      ref={canvasRef}
      className="nota-gyro__bola"
      style={{ width: NOTA.bola, height: NOTA.bola }}
      aria-hidden
    />
  );

  /* As tintas literais da nota entram por variável: o CSS não repete valor. */
  const tintas = {
    ["--nota-gyro-pilula" as string]: NOTA.pilula,
    ["--nota-gyro-rotulo" as string]: NOTA.rotuloCor,
  } as React.CSSProperties;

  if (!comPilula) {
    return (
      <div className={`nota-gyro${className ? ` ${className}` : ""}`} style={tintas} role="status" aria-label={rotulo}>
        {bola}
        {comRotulo && <span className="nota-gyro__rotulo">{rotulo}</span>}
      </div>
    );
  }

  return (
    <div
      className={`nota-gyro nota-gyro--pilula${className ? ` ${className}` : ""}`}
      style={tintas}
      role="status"
      aria-label={rotulo}
    >
      {bola}
      {comRotulo && <span className="nota-gyro__rotulo">{rotulo}</span>}
    </div>
  );
}

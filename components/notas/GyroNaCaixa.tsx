"use client";

/* ============================================================
   O LOOP DENTRO DA CAIXA RESERVADA

   Este componente existe por causa de um cuidado que o usuário deixou
   explícito, e que é a coisa mais fácil de perder nesta troca:

   > o placeholder do bloco 09 não é só um cinza bonito — ele **reserva a caixa
   > no tamanho final do artefato**, e é por isso que o layout não pula quando a
   > imagem chega.

   Então a regra deste arquivo é uma só: **ele nunca define a própria caixa.**
   Preenche o que o pai deu (`position:absolute; inset:0`) e centra a bola de
   46px dentro. Quem reserva o espaço continua sendo o `.pj-placeholder` do
   painel e o `.pjc-placeholder` do canvas, com a largura e a altura que vêm da
   geometria do artefato — exatamente como estavam.

   O que sai é só o shimmer cinza; o que entra é o loop, no mesmo lugar.

   Se a caixa for menor que a bola, a bola some e fica só o fundo neutro: um
   gyro cortado é pior que nenhum. O limiar é medido com `ResizeObserver`,
   porque a caixa vem do artefato e varia.
   ============================================================ */

import * as React from "react";
import { NOTA } from "./gyro";
import { GyroLoop } from "./GyroLoop";
import "./notas.css";

/** Abaixo disto a bola não cabe com folga e é melhor não desenhá-la. */
const MINIMO = NOTA.bola + 16;

export function GyroNaCaixa({ rotulo }: { rotulo?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [cabe, setCabe] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setCabe(r.width >= MINIMO && r.height >= MINIMO);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="nota-gyro-caixa" ref={ref} aria-hidden={!rotulo}>
      {cabe && <GyroLoop comPilula={false} comRotulo={!!rotulo} rotulo={rotulo} />}
    </div>
  );
}

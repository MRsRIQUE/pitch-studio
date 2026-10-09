"use client";

/* ============================================================
   O ORBE COMO FUNDO DE TELA VAZIA

   O shader da nota é vistoso: um orbe marmorizado sobre preto, ocupando a
   caixa inteira. Como fundo de um estado vazio ele competiria com o texto —
   que é justamente o que o usuário pediu para não acontecer. Este arquivo é a
   camada de discrição, e ela **não toca em nenhum número do shader**: o
   `orbe.glsl.ts` continua idêntico ao da nota. O que muda é o que se faz com a
   imagem depois de pronta.

   Três coisas, todas em CSS:

   1. **A moldura preta some.** Fora do raio 0.86 o shader devolve preto opaco,
      e preto atrás de um texto cinza numa tela clara é o oposto de discreto.
      Uma máscara radial recorta só o miolo do orbe e desfaz a borda — o preto
      nunca chega a ser pintado sobre a página.
   2. **A opacidade cai.** O padrão é 0.14: o suficiente para o movimento ser
      percebido, longe do necessário para disputar leitura.
   3. **Um desfoque leve** tira a marmorização de alta frequência, que é o que
      mais rouba atenção perto de texto pequeno.

   O contraste do texto por cima foi medido depois de posto, e está no
   relatório da leva 9.
   ============================================================ */

import * as React from "react";
import { OrbeShader } from "./OrbeShader";
import "./notas.css";

export interface PropsFundo {
  /** Opacidade da camada. O padrão é o valor que passou na medição. */
  opacidade?: number;
  /** Desfoque em px. */
  desfoque?: number;
  className?: string;
}

export function FundoOrbe({ opacidade = 0.14, desfoque = 18, className }: PropsFundo) {
  const [podeAnimar, setPodeAnimar] = React.useState(false);

  /* Com movimento reduzido o fundo não entra: um orbe que se mexe atrás de um
     texto é exatamente o tipo de coisa que a preferência pede para desligar. */
  React.useEffect(() => {
    setPodeAnimar(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!podeAnimar) return null;

  return (
    <div
      className={`nota-fundo${className ? ` ${className}` : ""}`}
      style={{ opacity: opacidade, filter: `blur(${desfoque}px)` }}
      aria-hidden
    >
      <OrbeShader />
    </div>
  );
}

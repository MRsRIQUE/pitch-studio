"use client";

/* ============================================================
   A ÁREA DO ACERVO — a terceira seção (680×267)

   Na referência é "Tokens / 667.7M tokens / +9.4%" sobre uma curva
   preenchida. O que veio de lá, medido no SVG:

   - a área é um `linearGradient` VERTICAL (x1=0 y1=0 x2=0 y2=1) da
     cor de acento a **0,32** de opacidade até 0;
   - a linha tem **2px** e é quebrada em trechos: os com dado saem na
     cor de acento, e há um trecho em cinza neutro. Aqui esse trecho
     tem significado: é o pedaço da janela ANTERIOR à primeira peça
     do acervo — o tempo em que não havia nada para contar;
   - o cabeçalho tem `margin-bottom: -32px`, então a curva passa por
     baixo do número, e é o `z-index: 10` dele que o mantém legível;
   - a revelação é um recorte que anda da esquerda para a direita,
     `clip-path: inset(0 100% 0 0) → inset(0)` em **1,8s** — o gesto
     mais longo da tela.

   A curva é feita de segmentos retos, como na referência (os `d` dos
   `recharts-line-curve` de lá são polilinhas, não bézier).
   ============================================================ */

import * as React from "react";

import { plural, rotuloDiaMes, diaZero, chaveDoDia, type Peca } from "./dados";

const LARGURA = 680;
const ALTURA = 200;
/* O recorte do gráfico da referência é `y=27 h=171` dentro da caixa
   de 200: a curva nunca encosta no topo nem no fundo da seção. */
const TOPO = 27;
const BASE = 198;

const DIA_MS = 86_400_000;
const JANELA_MIN = 30;
const JANELA_MAX = 180;

export function AreaAcervo({ pecas }: { pecas: Peca[] }) {
  const serie = React.useMemo(() => {
    const hoje = diaZero(new Date()).getTime();

    /* Por dia, quantas peças entraram. */
    const porDia = new Map<string, number>();
    for (const peca of pecas) {
      const chave = chaveDoDia(new Date(peca.created_at));
      porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
    }

    const primeira = pecas.length
      ? diaZero(new Date(pecas.reduce((min, p) => (p.created_at < min ? p.created_at : min), pecas[0].created_at))).getTime()
      : hoje;

    /* A janela acompanha a idade do acervo, com folga de uma semana,
       entre 30 e 180 dias. Fixá-la em 180 num acervo de uma semana
       daria uma reta rente ao chão com um degrau invisível no fim. */
    const idade = Math.round((hoje - primeira) / DIA_MS) + 7;
    const janela = Math.min(JANELA_MAX, Math.max(JANELA_MIN, idade));
    const inicio = hoje - (janela - 1) * DIA_MS;

    const pontos: { x: number; y: number; acumulado: number; data: Date }[] = [];
    let acumulado = 0;
    let noPeriodo = 0;
    let metadeAnterior = 0;
    for (let i = 0; i < janela; i++) {
      const data = new Date(inicio + i * DIA_MS);
      const doDia = porDia.get(chaveDoDia(data)) ?? 0;
      acumulado += doDia;
      noPeriodo += doDia;
      if (i < Math.floor(janela / 2)) metadeAnterior += doDia;
      pontos.push({ x: 0, y: 0, acumulado, data });
    }

    const maximo = Math.max(1, acumulado);
    pontos.forEach((ponto, i) => {
      ponto.x = (i * LARGURA) / (janela - 1);
      ponto.y = BASE - (ponto.acumulado / maximo) * (BASE - TOPO);
    });

    /* Onde a curva deixa de ser cinza: o último ponto ainda zerado. */
    const primeiroComDado = pontos.findIndex(p => p.acumulado > 0);
    const corte = primeiroComDado <= 0 ? 0 : primeiroComDado - 1;

    const metadeRecente = noPeriodo - metadeAnterior;
    const variacao = metadeAnterior > 0
      ? ((metadeRecente - metadeAnterior) / metadeAnterior) * 100
      : null;

    return { pontos, corte, temDado: primeiroComDado >= 0, total: pecas.length, variacao, inicio: new Date(inicio) };
  }, [pecas]);

  const d = (de: number, ate: number) =>
    serie.pontos.slice(de, ate + 1).map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const ultimo = serie.pontos.length - 1;
  const areaD = `${d(0, ultimo)} L${LARGURA},${BASE} L0,${BASE} Z`;

  return (
    <section className="pf-secao--area" aria-labelledby="pf-area-titulo">
      <div className="pf-secao__cabecalho">
        <div className="pf-secao__titulo">
          <p className="pf-rotulo" id="pf-area-titulo">Acervo</p>
          <div className="pf-destaque__linha">
            <p key={serie.total} className="pf-secao__valor pf-anima-numero">
              {plural(serie.total, "peça", "peças")}
            </p>
            {serie.variacao !== null && (
              <span className="pf-selo pf-selo--marca">
                {serie.variacao >= 0 ? "+" : "−"}
                {Math.abs(serie.variacao).toFixed(1).replace(".", ",")}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pf-area pf-anima-revelar">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Peças acumuladas no acervo desde ${rotuloDiaMes(serie.inicio)}`}
        >
          <defs>
            <linearGradient id="pf-area-degrade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--ms-brand-7))" stopOpacity="0.32" />
              <stop offset="100%" stopColor="hsl(var(--ms-brand-7))" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={areaD} fill="url(#pf-area-degrade)" stroke="none" />

          {/* O trecho anterior à primeira peça: cinza, porque ali não
              havia acervo para medir. */}
          {serie.corte > 0 && (
            <path
              d={d(0, serie.corte)}
              fill="none"
              stroke="hsl(var(--ms-gray-8))"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {serie.temDado && (
            <path
              d={d(serie.corte, ultimo)}
              fill="none"
              stroke="hsl(var(--ms-brand-7))"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {!serie.temDado && (
            <path
              d={d(0, ultimo)}
              fill="none"
              stroke="hsl(var(--ms-gray-8))"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      <div className="pf-eixo">
        <p>{rotuloDiaMes(serie.inicio)}</p>
        <p>Hoje</p>
      </div>
    </section>
  );
}

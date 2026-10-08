"use client";

/* ============================================================
   O MAPA DE ATIVIDADE

   38 colunas × 7 linhas = 266 células de 13px com 4 de vão, como na
   referência. Duas coisas medidas no DOM dela e reproduzidas aqui:

   1. A ORDEM. O DOM é linha-a-linha (índice = linha×38 + coluna),
      mas a DATA anda coluna-a-coluna (índice de data = coluna×7 +
      linha). Confirmado nos `aria-label` da referência: a primeira
      linha lê "Jan 1 · Jan 11 · Jan 20 · Jan 30", passo de ~9,6
      dias, e a célula 38 (início da segunda linha) lê "Jan 2".
      É a grade do GitHub transposta, e com o ano COMPRIMIDO em 266
      baldes em vez de um dia por célula.

   2. A ENTRADA. As células vazias não animam — entram prontas. Só as
      que têm atividade rodam `cell-pop` (.38s ease-out), e o atraso
      de cada uma é SORTEADO entre ~10 e ~800ms: medi 200 atrasos na
      referência e eles não formam varredura nenhuma, é pipoca. Aqui
      o sorteio virou uma função do índice, para que dois renders
      seguidos não reembaralhem a tela.

   O período muda o tamanho do balde, não o tamanho da grade — que é
   o único jeito de o controle fazer algo real sobre os nossos dados:
   a referência tem os três botões, mas o template é estático e os
   três mostram a mesma coisa.
   ============================================================ */

import * as React from "react";

import { chaveDoDia, diaZero } from "./dados";

export type Periodo = "semanal" | "mensal" | "anual";

const COLUNAS = 38;
const LINHAS = 7;
const CELULAS = COLUNAS * LINHAS;   /* 266 */
const DIA_MS = 86_400_000;

/** Quantos dias a grade inteira cobre, por período. */
const JANELA: Record<Periodo, number> = {
  semanal: CELULAS,   /* 1 célula = 1 dia — 38 semanas */
  mensal: 365,        /* o ano comprimido, que é o que a referência mostra */
  anual: 1826,        /* cinco anos: ~6,9 dias por célula */
};

const NOMES: Record<Periodo, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
};

/* Sorteio estável: mesmo índice, mesmo atraso, render após render.
   A referência sorteia de verdade a cada carga; a diferença não é
   visível e evita a grade repipocar a cada re-render do React. */
function atraso(indice: number): number {
  const x = Math.sin(indice * 12.9898) * 43758.5453;
  return 10 + Math.floor((x - Math.floor(x)) * 780);
}

const rotuloData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

interface Balde {
  inicio: Date;
  fim: Date;
  valor: number;
}

export function MapaAtividade({
  porDia,
  periodo,
  onPeriodo,
}: {
  porDia: Map<string, number>;
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
}) {
  const baldes = React.useMemo<Balde[]>(() => {
    const dias = JANELA[periodo];
    const hoje = diaZero(new Date());
    const inicioJanela = hoje.getTime() - (dias - 1) * DIA_MS;

    const lista: Balde[] = [];
    for (let k = 0; k < CELULAS; k++) {
      const primeiroDia = Math.round((k * dias) / CELULAS);
      const ultimoDia = Math.round(((k + 1) * dias) / CELULAS) - 1;
      let valor = 0;
      for (let d = primeiroDia; d <= ultimoDia; d++) {
        valor += porDia.get(chaveDoDia(new Date(inicioJanela + d * DIA_MS))) ?? 0;
      }
      lista.push({
        inicio: new Date(inicioJanela + primeiroDia * DIA_MS),
        fim: new Date(inicioJanela + Math.max(primeiroDia, ultimoDia) * DIA_MS),
        valor,
      });
    }
    return lista;
  }, [porDia, periodo]);

  const maximo = React.useMemo(() => baldes.reduce((m, b) => Math.max(m, b.valor), 0), [baldes]);

  return (
    <>
      <div className="pf-atividade">
        <p className="pf-atividade__rotulo">Atividade</p>
        <div className="pf-segmentado" role="radiogroup" aria-label="Período da atividade">
          {(Object.keys(NOMES) as Periodo[]).map(chave => (
            <button
              key={chave}
              type="button"
              role="radio"
              aria-checked={periodo === chave}
              className="pf-segmentado__opcao"
              onClick={() => onPeriodo(chave)}
            >
              {NOMES[chave]}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-mapa-rolagem">
        {/* A `key` é o gatilho da pipoca: trocar de período remonta as
            266 células e `cell-pop` roda de novo, sem nenhuma linha de
            JavaScript de animação. */}
        <div key={periodo} className="pf-mapa">
          {Array.from({ length: CELULAS }).map((_, domIndice) => {
            const linha = Math.floor(domIndice / COLUNAS);
            const coluna = domIndice % COLUNAS;
            const balde = baldes[coluna * LINHAS + linha];
            const nivel = balde.valor === 0 || maximo === 0
              ? 0
              : Math.min(5, Math.max(1, Math.ceil((balde.valor / maximo) * 5)));

            const quando = balde.inicio.getTime() === balde.fim.getTime()
              ? `em ${rotuloData.format(balde.inicio).replace(".", "")}`
              : `entre ${rotuloData.format(balde.inicio).replace(".", "")} e ${rotuloData.format(balde.fim).replace(".", "")}`;

            return (
              <button
                key={domIndice}
                type="button"
                tabIndex={-1}
                className={`pf-celula${nivel > 0 ? " pf-anima-celula" : ""}`}
                data-nivel={nivel}
                style={nivel > 0 ? { animationDelay: `${atraso(domIndice)}ms` } : undefined}
                aria-label={
                  balde.valor === 0
                    ? `Sem gerações ${quando}`
                    : `${balde.valor} ${balde.valor === 1 ? "geração" : "gerações"} ${quando}`
                }
                title={
                  balde.valor === 0
                    ? `Sem gerações ${quando}`
                    : `${balde.valor} ${balde.valor === 1 ? "geração" : "gerações"} ${quando}`
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

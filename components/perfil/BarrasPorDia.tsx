"use client";

/* ============================================================
   BARRAS POR DIA — a segunda seção (680×317)

   Na referência é "Agents / 32 agents" com um passador de mês no
   canto e uma barra por dia. Aqui é o mesmo desenho com o nosso
   dado: uma barra por dia do mês, altura proporcional às gerações
   daquele dia.

   Três coisas medidas na referência e reproduzidas:

   - as barras sobem do chão (`scaleY 0 → 1`, .36s
     cubic-bezier(.22,1,.36,1)) com **22ms** de defasagem entre
     vizinhas — o valor estava no `animation-delay` inline de cada
     uma: 0, 22, 44, 66…;
   - dia sem atividade não é buraco: é um traço de **4px** na cor do
     trilho, e ele também sobe;
   - a troca de mês não remonta as barras — a altura anda por
     `transition: height .3s ease`. Quem remonta é só o rótulo, que
     cruza com `label-out`/`label-in` (.22s ease-out) enquanto um
     clone invisível segura a largura do nome NOVO.
   ============================================================ */

import * as React from "react";

import { ChevronLeft, ChevronRight } from "@/components/icones";
import { chaveDoDia, plural, rotuloDiaMes, rotuloMes } from "./dados";

const TRILHO = 206;   /* altura da caixa das barras */
const VAZIA = 4;      /* o traço do dia sem atividade */
const DEFASAGEM = 22; /* ms entre barras vizinhas */

function mesmoMes(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function BarrasPorDia({ porDia }: { porDia: Map<string, number> }) {
  const hoje = React.useMemo(() => new Date(), []);
  const [mes, setMes] = React.useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const dias = React.useMemo(() => {
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const data = new Date(mes.getFullYear(), mes.getMonth(), i + 1);
      return { data, valor: porDia.get(chaveDoDia(data)) ?? 0 };
    });
  }, [mes, porDia]);

  const maximo = dias.reduce((m, d) => Math.max(m, d.valor), 0);
  const totalDoMes = dias.reduce((s, d) => s + d.valor, 0);

  /* Para trás é livre, como na referência: um mês sem geração não é
     erro, é um mês de trilhos vazios — e essa é a informação. Para a
     frente para no mês corrente, porque o eixo do bloco termina em
     hoje e um mês futuro seria vazio por definição, não por falta de
     uso. */
  const podeAvancar = !mesmoMes(mes, hoje);

  const passar = (delta: number) =>
    setMes(atual => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));

  return (
    <section className="pf-secao" aria-labelledby="pf-barras-titulo">
      <div className="pf-secao__cabecalho">
        <div className="pf-secao__titulo">
          <p className="pf-rotulo" id="pf-barras-titulo">Gerações</p>
          {/* A `key` é o gatilho do reacender: trocar de mês troca o
              número e a animação de .22s roda de novo. */}
          <p key={totalDoMes} className="pf-secao__valor pf-anima-numero">
            {plural(totalDoMes, "geração", "gerações")}
          </p>
        </div>
      </div>

      <Passador
        rotulo={rotuloMes(mes)}
        podeAvancar={podeAvancar}
        onVoltar={() => passar(-1)}
        onAvancar={() => passar(1)}
      />

      <div className="pf-barras" role="img" aria-label={`Gerações por dia em ${rotuloMes(mes)}`}>
        {dias.map((dia, i) => {
          const altura = dia.valor === 0 || maximo === 0
            ? VAZIA
            : VAZIA + (dia.valor / maximo) * (TRILHO - VAZIA);
          return (
            <div key={dia.data.getTime()} className="pf-barras__coluna">
              <div
                className={`pf-barra pf-anima-barra${dia.valor === 0 ? " pf-barra--vazia" : ""}`}
                style={{ height: `${Math.round(altura)}px`, animationDelay: `${i * DEFASAGEM}ms` }}
                title={`${rotuloDiaMes(dia.data)} · ${plural(dia.valor, "geração", "gerações")}`}
              />
            </div>
          );
        })}
      </div>

      <div className="pf-eixo">
        <p>{rotuloDiaMes(dias[0].data)}</p>
        <p>{rotuloDiaMes(dias[dias.length - 1].data)}</p>
      </div>
    </section>
  );
}

/* ============================================================
   O PASSADOR

   O rótulo é uma pilha de três: um clone invisível que segura a
   largura do nome novo, e duas camadas absolutas que cruzam. Sem o
   clone, a caixa saltaria de "Setembro" para "Maio" no meio da
   travessia.
   ============================================================ */
function Passador({
  rotulo,
  podeAvancar,
  onVoltar,
  onAvancar,
}: {
  rotulo: string;
  podeAvancar: boolean;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const [saindo, setSaindo] = React.useState<string | null>(null);
  const anterior = React.useRef(rotulo);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (anterior.current === rotulo) return;
    setSaindo(anterior.current);
    anterior.current = rotulo;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaindo(null), 220);
  }, [rotulo]);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, []);

  return (
    <div className="pf-passador">
      <button
        type="button"
        className="pf-passador__seta pf-press"
        aria-label="Mês anterior"
        onClick={onVoltar}
      >
        <ChevronLeft size={16} />
      </button>

      <span className="pf-passador__rotulo">
        <span className="pf-passador__fantasma">{rotulo}</span>
        {saindo && (
          <span className="pf-passador__camada pf-anima-rotulo-sai" aria-hidden="true">{saindo}</span>
        )}
        <span key={rotulo} className="pf-passador__camada pf-anima-rotulo-entra">{rotulo}</span>
      </span>

      <button
        type="button"
        className="pf-passador__seta pf-press"
        aria-label="Próximo mês"
        disabled={!podeAvancar}
        onClick={onAvancar}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

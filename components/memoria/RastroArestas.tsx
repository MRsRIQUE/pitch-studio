"use client";

/* ============================================================
   O RASTRO DE ENERGIA DAS ARESTAS

   Segunda animação do bloco 08, também `requestAnimationFrame`
   em `<canvas>`. Um canvas de tela cheia varre os
   `.react-flow__edge-path`, aplica a mesma transform do viewport,
   amostra cada curva com `getPointAtLength` e desenha pulsos de
   50px espaçados de 80px caminhando a 0,1px/ms — em duas passadas:
   halo largo por baixo, núcleo fino por cima.

   Todas as constantes são as literais do chunk da referência
   (`st`, `Se`, `ts`, `os`, `ns`, `ss`, `rs`, `as`, `rt`, `at`). O
   par de cores é o único desvio: onde ela usa `rgba(255,121,8)` e
   `rgba(255,213,122)`, usamos Violeta e Lilás claro — lidos do
   CSS, não cravados.

   E a regra que faz a coisa toda funcionar: o laço SÓ desenha
   quando há nó em hover ou selecionado. Parado, o canvas fica
   limpo e as arestas são só o traço cinza de 1.5 a 60%.
   ============================================================ */

import { useEffect, useRef } from "react";
import { useStoreApi } from "@xyflow/react";

const PULSO = 50;        // st  comprimento aceso
const VAO = 80;          // Se  espaçamento entre pulsos
const VELOCIDADE = 0.1;  // ts  px por ms
const INTENSIDADE_MIN = 0.02; // os
const SEG_PARADO = 5;    // ns  px por segmento depois que assenta
const SEG_MOVENDO = 12;  // ss  px por segmento enquanto o `d` muda
const SEG_MIN = 16;      // rs
const SEG_MAX = 200;     // as
const ESPESSURA_BASE = 0.8; // rt
const GANHO = 1;         // at
const QUADROS_ATE_ASSENTAR = 6;

/** Qual conjunto de arestas está aceso: nenhuma, todas, ou estas. */
export type Acesas = null | "todas" | Set<string>;

interface Amostra {
  d: string;
  segmentos: number;
  pontos: { x: number; y: number }[];
  distancias: number[];
  comprimento: number;
}

/** `#rrggbb` → "r, g, b", que é a forma que o `rgba()` do canvas pede. */
function hexParaTripla(bruto: string, reserva: string): string {
  const hex = bruto.trim().replace("#", "");
  if (hex.length < 6) return reserva;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ].join(", ");
}

/* `ls`: meio cosseno. O pulso tem 50px e acende suave nas duas
   pontas, em vez de ligar e desligar em degrau. */
function intensidade(em: number, pulsos: number[], vao: number) {
  let melhor = 0;
  for (const p of pulsos) {
    const delta = em - p;
    if (delta < 0 || delta > vao) continue;
    const v = (Math.cos((delta / vao) * Math.PI) + 1) / 2;
    if (v > melhor) melhor = v;
  }
  return melhor;
}

export function RastroArestas({ acesas }: { acesas: Acesas }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* `useStoreApi` e não `useStore(s => s.transform)`: o transform é
     um array recriado a cada atualização do store, então assiná-lo
     re-renderizaria este componente — e derrubaria e remontaria o
     laço — a cada quadro de zoom ou pan. Lido dentro do quadro, o
     laço monta uma vez e nunca reinicia. */
  const store = useStoreApi();
  // Em ref pelo mesmo motivo: o hover muda muitas vezes por segundo.
  const acesasRef = useRef<Acesas>(acesas);
  useEffect(() => { acesasRef.current = acesas; }, [acesas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const estilo = getComputedStyle(canvas);
    const halo = hexParaTripla(estilo.getPropertyValue("--mem-rastro-halo"), "67, 24, 255");
    const nucleo = hexParaTripla(estilo.getPropertyValue("--mem-rastro-nucleo"), "169, 173, 255");

    const dpr = window.devicePixelRatio || 1;
    const ultimoD = new WeakMap<SVGPathElement, string>();
    const cacheAmostra = new WeakMap<SVGPathElement, Amostra>();
    let estavel = Infinity;

    const amostrar = (el: SVGPathElement, d: string, segmentos: number): Amostra | null => {
      const guardada = cacheAmostra.get(el);
      if (guardada && guardada.d === d && guardada.segmentos === segmentos) return guardada;
      const comprimento = el.getTotalLength();
      if (!isFinite(comprimento) || comprimento < 1) return null;
      const pontos: { x: number; y: number }[] = [];
      const distancias: number[] = [];
      for (let i = 0; i <= segmentos; i++) {
        const em = (i / segmentos) * comprimento;
        const p = el.getPointAtLength(em);
        pontos.push({ x: p.x, y: p.y });
        distancias.push(em);
      }
      const nova = { d, segmentos, pontos, distancias, comprimento };
      cacheAmostra.set(el, nova);
      return nova;
    };

    let quadro = 0;
    const desenhar = (t: number) => {
      quadro = requestAnimationFrame(desenhar);

      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      if (canvas.width !== Math.round(largura * dpr) || canvas.height !== Math.round(altura * dpr)) {
        canvas.width = Math.round(largura * dpr);
        canvas.height = Math.round(altura * dpr);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ativas = acesasRef.current;
      if (ativas === null) return;

      const [vx, vy, zoom] = store.getState().transform;
      ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, vx * dpr, vy * dpr);
      ctx.lineCap = "round";

      const caminhos = document.querySelectorAll<SVGPathElement>(".mem-overlay .react-flow__edge-path");

      // Amostragem grossa nos 6 quadros seguintes a qualquer mudança
      // de `d`, fina depois que assenta — é mais barato quando está parado.
      let mudou = false;
      const mapaD = new Map<SVGPathElement, string>();
      caminhos.forEach(el => {
        const d = el.getAttribute("d") || "";
        mapaD.set(el, d);
        if (ultimoD.get(el) !== d) { mudou = true; ultimoD.set(el, d); }
      });
      estavel = mudou ? 0 : estavel + 1;
      const segPx = estavel < QUADROS_ATE_ASSENTAR ? SEG_MOVENDO : SEG_PARADO;

      caminhos.forEach((el, idx) => {
        if (ativas !== "todas") {
          const id = el.closest(".react-flow__edge")?.getAttribute("data-id");
          if (!id || !ativas.has(id)) return;
        }
        const d = mapaD.get(el) || "";
        const segmentos = Math.max(SEG_MIN, Math.min(SEG_MAX, Math.round(el.getTotalLength() / segPx)));
        const s = amostrar(el, d, segmentos);
        if (!s) return;

        // `idx * 53 % 80` dá a cada aresta uma fase diferente; sem
        // isso os quatro cabos pulsariam em uníssono.
        const defasagem = (idx * 53) % VAO;
        const cabeca = s.comprimento - ((t * VELOCIDADE + defasagem) % VAO);
        const pulsos: number[] = [];
        const ultimo = -Math.ceil((s.comprimento + PULSO) / VAO) - 1;
        for (let c = 1; c >= ultimo; c -= 1) pulsos.push(cabeca + c * VAO);

        for (let passada = 0; passada < 2; passada++) {
          for (let e = 0; e < s.pontos.length - 1; e++) {
            const meio = (s.distancias[e] + s.distancias[e + 1]) / 2;
            const h = intensidade(meio, pulsos, PULSO);
            if (h < INTENSIDADE_MIN) continue;
            ctx.beginPath();
            ctx.moveTo(s.pontos[e].x, s.pontos[e].y);
            ctx.lineTo(s.pontos[e + 1].x, s.pontos[e + 1].y);
            if (passada === 0) {
              ctx.strokeStyle = `rgba(${halo}, ${h * 0.7})`;
              ctx.lineWidth = ESPESSURA_BASE + h * GANHO * 2;
            } else {
              ctx.strokeStyle = `rgba(${nucleo}, ${h * 0.95})`;
              ctx.lineWidth = ESPESSURA_BASE + h * GANHO * 0.5;
            }
            ctx.stroke();
          }
        }
      });
    };

    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [store]);

  return <canvas ref={canvasRef} aria-hidden="true" className="mem-rastro" />;
}

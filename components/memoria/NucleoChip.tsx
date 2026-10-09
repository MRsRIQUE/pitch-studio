"use client";

/* ============================================================
   O NÚCLEO VIVO

   Primeira das duas animações do bloco 08 — e as duas são
   `requestAnimationFrame` em `<canvas>`: não há um único
   `@keyframes` nesta tela.

   282 pontos numa grade de 1024 unidades reduzida por `K = .125`
   para caber nos 128px do nó. Uma banda de largura `.68` (em raio
   normalizado) caminha de FORA para DENTRO a cada 2600ms,
   interpolando cada ponto da cor base para a cor de realce.

   As matrizes `ROWS` (`Pn`) e `CANTOS` (`Dn`), as constantes e a
   função da onda são as literais do chunk da referência, copiadas
   do `<style>`/`<script>` do `preview.html`. O que muda é só o par
   de cores: onde a referência anda de #ff7908 a #ffb508, andamos
   do Violeta ao Lilás — mesma relação (marca → marca clareada),
   nossa cor. Elas são LIDAS do CSS, nunca cravadas aqui.
   ============================================================ */

import { useEffect, useRef } from "react";

const TAMANHO = 128;              // we
const K = 0.125;                  // 1024 → 128
const PERIODO = 2600;             // tt (ms)
const RAIO_PONTO = 15 * K;        // ot  1.875
const RAIO_PERNA = 10 * K;        // ke  1.25
const CENTRO = 512 * K;           // nt  64
const RAIO_MAX = 520 * K;         // Tn  65
const BANDA = 0.68;               // je

/* `Pn` — [y, [x, x, …]]. O disco tem uma fenda vertical entre as
   linhas 390 e 615: é o "corte" do chip. */
const ROWS: [number, number[]][] = [
  [71, [399, 444, 489, 534, 580, 625]],
  [116, [308, 354, 399, 444, 489, 534, 580, 625, 670, 716]],
  [164, [218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806]],
  [210, [173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851]],
  [255, [173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851]],
  [300, [128, 173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851, 896]],
  [345, [128, 173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851, 896]],
  [390, [82, 128, 173, 218, 263, 308, 354, 399, 625, 670, 716, 761, 806, 851, 896, 941]],
  [435, [82, 128, 173, 218, 263, 308, 354, 670, 716, 761, 806, 851, 896, 941]],
  [480, [82, 128, 173, 218, 263, 308, 354, 670, 716, 761, 806, 851, 896, 941]],
  [525, [82, 128, 173, 218, 263, 308, 354, 670, 716, 761, 806, 851, 896, 941]],
  [570, [82, 128, 173, 218, 263, 308, 354, 670, 716, 761, 806, 851, 896, 941]],
  [615, [82, 128, 173, 218, 263, 308, 354, 670, 716, 761, 806, 851, 896, 941]],
  [660, [128, 173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851, 896]],
  [707, [128, 173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851, 896]],
  [752, [173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851]],
  [797, [173, 218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806, 851]],
  [842, [218, 263, 308, 354, 399, 444, 489, 534, 580, 625, 670, 716, 761, 806]],
  [887, [308, 354, 399, 444, 489, 534, 580, 625, 670, 716]],
  [931, [399, 444, 489, 534, 580, 625]],
];

/* `Dn` — os 12 pontos de canto, sempre na cor base: eles não
   participam da onda. */
const CANTOS: [number, number][] = [
  [67, 71], [112, 71], [67, 116], [910, 71], [956, 71], [956, 116],
  [69, 900], [69, 945], [112, 945], [956, 900], [910, 945], [956, 945],
];

/** As cinco posições das perninhas brancas, nos quatro lados. */
const PERNAS = [452, 482, 512, 542, 572];

type RGB = { r: number; g: number; b: number };

/** `#rgb` ou `#rrggbb`, que é a forma em que os tokens de marca vivem. */
function lerHex(bruto: string, reserva: RGB): RGB {
  const hex = bruto.trim().replace("#", "");
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return reserva;
}

function interpolar(a: RGB, b: RGB, t: number): string {
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/* `Rn`: a onda. `i = 1 - fase` faz a banda caminhar de fora para
   dentro; o ramo `d > 1` é o que a deixa dar a volta pelo centro
   sem piscar. Fora da banda, `p = 0` — a cor base. */
function corEm(x: number, y: number, fase: number, de: RGB, para: RGB): string {
  const a = Math.min(1, Math.hypot(x - CENTRO, y - CENTRO) / RAIO_MAX);
  const i = 1 - fase;
  const d = i + BANDA;
  const c = d > 1 ? d - 1 : d;
  let p = 0;
  if (d <= 1) {
    if (a >= i && a <= d) p = (a - i) / BANDA;
  } else if (a >= i || a <= c) {
    p = a >= i ? (a - i) / BANDA : (a + 1 - i) / BANDA;
  }
  return interpolar(de, para, p);
}

export function NucleoChip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const estilo = getComputedStyle(canvas);
    const de = lerHex(estilo.getPropertyValue("--mem-chip-de"), { r: 67, g: 24, b: 255 });
    const para = lerHex(estilo.getPropertyValue("--mem-chip-para"), { r: 134, g: 140, b: 255 });
    const branco = estilo.getPropertyValue("--mem-chip-branco").trim() || "#f7f8fa";
    const fundo = estilo.getPropertyValue("--mem-chip-fundo").trim() || "#000";

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(TAMANHO * dpr);
    canvas.height = Math.round(TAMANHO * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ponto = (x: number, y: number, r: number, tinta: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = tinta;
      ctx.fill();
    };

    const desenhar = (t: number) => {
      const fase = (t % PERIODO) / PERIODO;
      // O miolo do nó é preto de verdade, não `--ms-bg`: o canvas
      // repinta os 128×128 inteiros a cada quadro.
      ctx.fillStyle = fundo;
      ctx.fillRect(0, 0, TAMANHO, TAMANHO);

      for (const [linha, colunas] of ROWS) {
        const y = linha * K;
        for (const bruto of colunas) {
          const x = bruto * K;
          ponto(x, y, RAIO_PONTO, corEm(x, y, fase, de, para));
        }
      }
      for (const [x, y] of CANTOS) {
        ponto(x * K, y * K, RAIO_PONTO, interpolar(de, para, 0));
      }
      for (const v of PERNAS) {
        ponto(v * K, 398 * K, RAIO_PERNA, branco);
        ponto(v * K, 625 * K, RAIO_PERNA, branco);
        ponto(400 * K, v * K, RAIO_PERNA, branco);
        ponto(624 * K, v * K, RAIO_PERNA, branco);
      }
      // o quadrado branco do miolo
      ctx.strokeStyle = branco;
      ctx.lineWidth = 16 * K;
      ctx.lineJoin = "round";
      ctx.strokeRect(435 * K, 434 * K, 153 * K, 155 * K);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      desenhar(0);
      return;
    }

    let quadro = 0;
    const laco = (t: number) => {
      desenhar(t);
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Animação de pontos do núcleo da memória"
      width={TAMANHO}
      height={TAMANHO}
    />
  );
}

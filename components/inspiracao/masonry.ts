/* ============================================================
   MASONRY DO BLOCO 05

   Transcrição literal de `js/masonry-grid-B0wJHq4C.js` com as constantes de
   `js/index-BDphy4Dt.js`, `js/inspiration-v2-card-BbNwVMHt.js` e
   `js/inspiration-card-NwyZ6O_X.js`, na tabela do
   `miora/sections/05-inspiration-box/INFO.md`.

   O `ROW_GAP` é 4, e o `BOTTOM_AREA` é 85 embora a barra de baixo meça 69px de
   verdade (10 + 22 + 3 + 4 + 20 + 10). Os dois andam juntos: a folga de 16px
   está dentro da estimativa, e é ela que produz o vão de 22px que aparece na
   tela. Copiar um sem o outro erra o espaçamento em 16px por linha e acumula o
   erro pela coluna toda.

   A altura estimada só posiciona a célula. A altura real do card vem do
   `aspect-ratio` do quadro da capa — por isso a grade não pula quando as capas
   chegam, e por isso a célula recebe `top/left/width` e nunca `height`.
   ============================================================ */

/** `minColWidth` padrão do MasonryGrid. A 1310px dá `floor(1326/276)` = 4 colunas. */
export const MIN_COL_WIDTH = 260;
export const COL_GAP = 16;
export const ROW_GAP = 4;

/** `le` de `inspiration-v2-card`: as três constantes da estimativa de altura. */
export const BORDER_TOTAL = 2;
export const BOTTOM_AREA = 85;
export const MEDIA_MIN_HEIGHT = 180;

/* O quadro da capa recebe a proporção já clampada — é por isso que na
   referência aparece `1.77778/1` de um lado e `0.5625/1` do outro, e nunca nada
   acima de 1.78. */
export const AR_MIN = 0.3;
export const AR_MAX = 1.78;

export interface MasonryCell {
  left: number;
  top: number;
  width: number;
}

export interface MasonryLayout {
  cells: MasonryCell[];
  columnCount: number;
  columnWidth: number;
  totalHeight: number;
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(AR_MAX, Math.max(AR_MIN, ratio));
}

/** Converte `"16:9"` em 1.7778. Devolve `null` para `"auto"` ou lixo. */
export function parseRatio(value: string | undefined): number | null {
  if (!value || value === "auto") return null;
  const [w, h] = value.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

/** `ge` de `js/index-BDphy4Dt.js`: `max((colW − 2)/ar, 180) + 2 + 85`. */
export function estimateHeight(ratio: number, columnWidth: number): number {
  const inner = columnWidth - BORDER_TOTAL;
  return Math.max(inner / clampRatio(ratio), MEDIA_MIN_HEIGHT) + BORDER_TOTAL + BOTTOM_AREA;
}

export function layoutMasonry(containerWidth: number, ratios: number[]): MasonryLayout {
  const columnCount = Math.max(1, Math.floor((containerWidth + COL_GAP) / (MIN_COL_WIDTH + COL_GAP)));
  const columnWidth = (containerWidth - (columnCount - 1) * COL_GAP) / columnCount;
  const heights = new Array<number>(columnCount).fill(0);
  const cells: MasonryCell[] = [];

  for (const ratio of ratios) {
    /* Sempre a coluna mais baixa; empate resolve no menor índice. */
    let column = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[column]) column = i;
    }

    cells.push({
      left: column * (columnWidth + COL_GAP),
      top: heights[column],
      width: columnWidth,
    });
    heights[column] += estimateHeight(ratio, columnWidth) + ROW_GAP;
  }

  const tallest = heights.length ? Math.max(...heights) : 0;
  return {
    cells,
    columnCount,
    columnWidth,
    totalHeight: Math.max(0, tallest - ROW_GAP),
  };
}

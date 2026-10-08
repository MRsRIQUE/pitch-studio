/* ============================================================
   DISTRIBUIÇÃO EM COLUNAS — a galeria lateral do BoardUI

   O painel do BoardUI (`/templates/ai-image-generation`) NÃO usa o masonry de
   "coluna mais baixa" do bloco 05 do Miora. Ele preenche as colunas **em
   sequência**: enfileira os itens na coluna atual, na ordem em que vêm, até a
   altura acumulada alcançar `total / número de colunas`, e só então passa para
   a próxima. O item que cruza o limite fica na coluna que estava sendo
   preenchida.

   A diferença é de leitura, não de estética: aqui a ordem de cima para baixo
   dentro de uma coluna é a ordem real dos itens, e a última coluna é sempre a
   mais curta. No masonry por coluna mais baixa a ordem se embaralha.

   Como isso foi apurado: as 21 peças do painel caíram em 8 / 7 / 6, com alturas
   de coluna 1413 / 1406 / 1196 px. "Coluna mais baixa" nunca produziria a
   terceira coluna 210px mais curta que as outras com 21 itens. Já a regra
   sequencial fecha exata: soma das alturas 3870,85 px, alvo 1290,28; a coluna 0
   passa de 1229,40 (7 itens) para 1357,40 no 8º, e a coluna 1 passa de 1129,17
   (6 itens) para 1357,73 no 7º — as duas cruzam o alvo exatamente no item em
   que o DOM as fecha. Sobram 6 para a última.

   A altura usada aqui é `1 / proporção`: como toda coluna tem a mesma largura,
   ela é proporcional à altura em pixels, e o resultado do corte é o mesmo.
   ============================================================ */

/** Proporção usada quando a peça não declara nenhuma. */
export const PROPORCAO_PADRAO = 1;

/**
 * Reparte `itens` em `colunas` listas, na ordem de entrada.
 *
 * `proporcao` devolve largura/altura do item (0.5625 para um 9:16). Itens sem
 * proporção conhecida entram como quadrados.
 */
export function distribuirEmColunas<T>(
  itens: T[],
  colunas: number,
  proporcao: (item: T) => number,
): T[][] {
  const saida: T[][] = Array.from({ length: Math.max(1, colunas) }, () => []);
  if (itens.length === 0) return saida;

  const alturas = itens.map(item => {
    const p = proporcao(item);
    return Number.isFinite(p) && p > 0 ? 1 / p : 1 / PROPORCAO_PADRAO;
  });
  const alvo = alturas.reduce((soma, h) => soma + h, 0) / saida.length;

  let coluna = 0;
  let acumulado = 0;
  itens.forEach((item, indice) => {
    saida[coluna].push(item);
    acumulado += alturas[indice];
    /* O item que cruza o alvo fica onde está; quem muda de coluna é o próximo.
       A última coluna nunca é fechada por alvo — ela recebe o resto. */
    if (acumulado >= alvo && coluna < saida.length - 1) {
      coluna += 1;
      acumulado = 0;
    }
  });

  return saida;
}

/* ============================================================
   AS CORES QUE NÃO VIRAM TOKEN — e por quê

   A leva 9 trocou as 308 cores cravadas dos nós e arestas por token da
   escala clara. Sobraram duas famílias que **não deviam** virar token, e
   elas moram aqui para que nenhum arquivo de nó tenha hex solto.

   1. A PALETA DO GRUPO é conteúdo, não tema. O usuário escolhe a cor da
      moldura numa grade de dez amostras; se as dez virassem token, duas
      escolhas diferentes passariam a pintar igual.

   2. Os SINAIS SEM TOKEN. Vermelho, verde, amarelo e azul têm degrau na
      escala (`--ms-solid-danger`, `--ms-text-success`, …). Ciano e teal
      não têm — e ciano é o sinal de voz/vídeo, que a leva mandou manter.
      **AVISO AO MAESTRO: falta uma rampa ciano em `app/tokens/ms.css`.**
      No dia em que existir, é trocar as três linhas abaixo.
   ============================================================ */

/**
 * As dez amostras do seletor de cor da moldura de grupo.
 *
 * NOTA: os rótulos e os valores já não batiam antes desta leva —
 * "Pink" é verde, "Orange" e "Yellow" são o mesmo âmbar, "Green" repete o
 * verde de "Pink". Copiei como estava para não mudar o que o usuário já
 * escolheu nos grupos existentes; corrigir muda cor de dado gravado.
 */
export const CORES_DE_GRUPO = [
  "#1b84ff", // Blue (padrão)
  "#6B5FE0", // Blue-600
  "#01b574", // Pink  ← rótulo não bate com o valor, ver nota
  "#e31a1a", // Red
  "#ffb547", // Orange
  "#ffb547", // Yellow ← igual ao Orange, ver nota
  "#01b574", // Green  ← igual ao "Pink", ver nota
  "#14b8a6", // Teal
  "#0bc5ea", // Cyan
  "#9ca3af", // Gray
] as const;

/** Sinais sem degrau na escala. Só estes — o resto é token. */
export const SINAL = {
  /** Voz e vídeo de referência. Sem rampa ciano nos tokens. */
  voz: "#0bc5ea",
  /** O mesmo ciano a 12% e a 25%, para a borda tracejada da área de solta. */
  vozTenue: "#0bc5ea1f",
  vozMedia: "#0bc5ea66",
  /** Teal do seletor de grupo, para a moldura casar com a amostra. */
  teal: "#14b8a6",
} as const;

/**
 * As duas tintas de 20% que pintam o alvo de encaixe quando uma aresta é
 * arrastada por cima. São translúcidas de propósito: entram sobre a
 * superfície do nó, não sobre o papel.
 */
export const TINTA_ENCAIXE = {
  aceita: "#2DD4BF33",
  recusa: "#fb923c33",
} as const;

/**
 * Estado de módulo que a grade do Acervo e o cartão compartilham.
 *
 * Estes três não são cache de conveniência: são *um* valor único que
 * `app/gallery/page.tsx` escreve e `GalleryCard` lê, e vice-versa.
 * Quando o cartão saiu do page.tsx para viver aqui em
 * `components/gallery/`, duplicá-los daria duas cópias divergentes —
 * o `_arrastoDoAcervo` em especial quebraria o solta-no-composer, que
 * é lido do outro lado do arquivo.
 *
 * Ao ligar o cartão novo, `page.tsx` precisa APAGAR as declarações
 * locais (hoje nas linhas ~206–241 do snapshot) e importar daqui.
 */

/** URLs cujo bitmap já entrou nesta sessão — evita o fade de entrada de novo. */
export const urlsCarregadas = new Set<string>();

/** url → "w / h". Alimenta a altura reservada na grade antes da mídia chegar. */
export const cacheDeProporcao = new Map<string, string>();

/**
 * Item em arrasto, guardado no módulo em vez de no `dataTransfer`.
 * O `getData()` só devolve valor no evento de drop em parte dos
 * navegadores; o tipo em `types` é o que sobrevive ao `dragover`.
 */
let itemEmArrasto: { url: string; mediaType: string } | null = null;

export function definirItemEmArrasto(item: { url: string; mediaType: string } | null) {
  itemEmArrasto = item;
}

export function consumirItemEmArrasto(): { url: string; mediaType: string } | null {
  const item = itemEmArrasto;
  itemEmArrasto = null;
  return item;
}

/* Reidrata da sessão: numa carga fria a grade já sabe as proporções e
   monta o layout certo de primeira, sem o pulo de reflow. */
if (typeof window !== "undefined") {
  try {
    const proporcoes = JSON.parse(sessionStorage.getItem("hg-ratios") ?? "{}") as Record<string, string>;
    for (const [url, r] of Object.entries(proporcoes)) cacheDeProporcao.set(url, r);
  } catch {}
  try {
    const carregadas = JSON.parse(sessionStorage.getItem("hg-loaded") ?? "[]") as string[];
    for (const url of carregadas) urlsCarregadas.add(url);
  } catch {}
}

/** Persiste o conjunto de carregadas; chamado quando uma URL cai (404, CDN fora). */
export function persistirCarregadas() {
  try { sessionStorage.setItem("hg-loaded", JSON.stringify([...urlsCarregadas])); } catch {}
}

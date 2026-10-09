/**
 * A categoria escolhida nas abas do composer (bloco 03).
 *
 * Mora em `lib/` e não no componente porque tem dois leitores em frentes
 * diferentes: as abas, que escrevem, e a linha de especialistas do bloco 04,
 * que lê. Um import direto entre as duas amarraria as frentes uma na outra;
 * um evento no `window` deixa cada lado subir sozinho.
 *
 * O valor é efêmero de propósito — a referência reinicia a categoria a cada
 * carga da Home, e clicar na aba ativa desliga a categoria (`null`).
 */

export const CATEGORIAS = [
  { id: "marca",   rotulo: "Marca"   },
  { id: "video",   rotulo: "Vídeo"   },
  { id: "produto", rotulo: "Produto" },
  { id: "social",  rotulo: "Social"  },
  { id: "web",     rotulo: "Web"     },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];

/** `null` = nenhuma categoria ativa, o estado inicial da referência. */
let atual: CategoriaId | null = null;

const EVENTO = "pitch-categoria-composer";

export function lerCategoria(): CategoriaId | null {
  return atual;
}

export function definirCategoria(id: CategoriaId | null): void {
  if (atual === id) return;
  atual = id;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }));
  }
}

/** Assina a troca de categoria. Devolve a função que cancela a assinatura. */
export function assinarCategoria(ouvinte: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO, ouvinte);
  return () => window.removeEventListener(EVENTO, ouvinte);
}

/**
 * As três frases do typewriter por categoria. A referência tem uma lista
 * genérica de 15 e três frases por aba; aqui as frases falam do que o nosso
 * app faz de verdade — gerar imagem e vídeo —, e não de sites nem de app.
 */
export const FRASES_POR_CATEGORIA: Record<CategoriaId, string[]> = {
  marca: [
    "Pitch, monte um kit de identidade para a minha marca",
    "Pitch, crie um logo e um visual-chave para uma marca de café",
    "Pitch, faça cartazes de marca para as redes sociais",
  ],
  video: [
    "Pitch, crie um storyboard de 30 segundos para um produto",
    "Pitch, gere as cenas de um vídeo de lançamento",
    "Pitch, transforme os benefícios do produto em roteiro de vídeo",
  ],
  produto: [
    "Pitch, gere imagens de destaque para o meu e-commerce",
    "Pitch, desenhe uma foto de produto que converte",
    "Pitch, crie um cartaz de promoção para um lançamento",
  ],
  social: [
    "Pitch, crie visuais que param a rolagem no feed",
    "Pitch, gere um carrossel para uma campanha de verão",
    "Pitch, desenhe uma capa para o meu próximo post",
  ],
  web: [
    "Pitch, gere as imagens de uma página de produto",
    "Pitch, crie ilustrações para as telas de boas-vindas",
    "Pitch, desenhe uma biblioteca de ícones em estilo plano",
  ],
};

/** As 15 frases genéricas — o estado sem categoria. */
export const FRASES_GERAIS = [
  "Pitch, me ajude a criar visuais que param a rolagem",
  "Pitch, monte um kit de identidade para a minha marca",
  "Pitch, crie um storyboard de 30 segundos para um produto",
  "Pitch, quero uma cena de cinema com chuva e neon",
  "Pitch, quero ilustrar os ícones de uma página",
  "Pitch, gere imagens de destaque para o meu e-commerce",
  "Pitch, quero desenhar um conjunto de banners de campanha",
  "Pitch, me ajude a desenhar um mascote em estilo cartum",
  "Pitch, quero um relatório visual limpo e bem diagramado",
  "Pitch, crie a animação de demonstração de um recurso",
  "Pitch, quero montar um portfólio com as minhas criações",
  "Pitch, desenhe cartazes com tema de fim de ano",
  "Pitch, quero uma biblioteca de ícones em estilo plano",
  "Pitch, crie as telas de boas-vindas de um aplicativo",
  "Pitch, quero gerar o roteiro em vídeo da história da marca",
];

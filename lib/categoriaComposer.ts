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
    "Monte um kit de identidade para a minha marca",
    "Crie um logo e um visual-chave para uma marca de café",
    "Faça cartazes de marca para as redes sociais",
  ],
  video: [
    "Crie um storyboard de 30 segundos para um produto",
    "Gere as cenas de um vídeo de lançamento",
    "Transforme os benefícios do produto em roteiro de vídeo",
  ],
  produto: [
    "Gere imagens de destaque para o meu e-commerce",
    "Desenhe uma foto de produto que converte",
    "Crie um cartaz de promoção para um lançamento",
  ],
  social: [
    "Crie visuais que param a rolagem no feed",
    "Gere um carrossel para uma campanha de verão",
    "Desenhe uma capa para o meu próximo post",
  ],
  web: [
    "Gere as imagens de uma página de produto",
    "Crie ilustrações para as telas de boas-vindas",
    "Desenhe uma biblioteca de ícones em estilo plano",
  ],
};

/** As 15 frases genéricas — o estado sem categoria. */
export const FRASES_GERAIS = [
  "Me ajude a criar visuais que param a rolagem",
  "Monte um kit de identidade para a minha marca",
  "Crie um storyboard de 30 segundos para um produto",
  "Quero uma cena de cinema com chuva e neon",
  "Quero ilustrar os ícones de uma página",
  "Gere imagens de destaque para o meu e-commerce",
  "Quero desenhar um conjunto de banners de campanha",
  "Me ajude a desenhar um mascote em estilo cartum",
  "Quero um relatório visual limpo e bem diagramado",
  "Crie a animação de demonstração de um recurso",
  "Quero montar um portfólio com as minhas criações",
  "Desenhe cartazes com tema de fim de ano",
  "Quero uma biblioteca de ícones em estilo plano",
  "Crie as telas de boas-vindas de um aplicativo",
  "Quero gerar o roteiro em vídeo da história da marca",
];

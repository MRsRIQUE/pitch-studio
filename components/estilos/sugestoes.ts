/* ============================================================
   PONTOS DE PARTIDA

   A segunda grade do bloco 06 é o marketplace do Miora. Não temos marketplace,
   e fingir um seria o pior tipo de mentira: números de download e versões que
   não existem.

   O que essa grade é aqui: seis fragmentos escritos por nós, para quem abre a
   tela pela primeira vez não encarar uma biblioteca vazia. Eles não vêm de
   servidor nenhum, não são baixados e não têm versão — clicar no `+` copia o
   texto para a biblioteca local do usuário, e a partir daí o estilo é dele,
   editável como qualquer outro.

   Mesma natureza dos textos de `components/CreationHome.tsx`: conteúdo
   editorial nosso, assumido como tal.

   A `version` é a revisão do texto que escrevemos — o `currentVersion` que o
   cartão de sugerido mostra ao lado do nome, e que o estilo herda ao ser
   adicionado. Ela sobe quando NÓS mudarmos o fragmento aqui, e é o único
   sentido de versão que um ponto de partida pode ter.
   ============================================================ */

export interface Sugestao {
  id: string;
  name: string;
  fragment: string;
  version: string;
}

export const SUGESTOES: Sugestao[] = [
  {
    id: "editorial",
    name: "Fotografia editorial",
    fragment:
      "Fotografia editorial, luz natural difusa vinda da lateral, sombras suaves e longas, paleta neutra e quente, grão fino de filme, profundidade de campo rasa, composição limpa com bastante espaço negativo.",
    version: "1.0.0",
  },
  {
    id: "produto",
    name: "Produto em estúdio",
    fragment:
      "Still de produto em estúdio, fundo infinito claro, luz principal difusa a 45°, preenchimento suave do lado oposto, reflexos controlados, nitidez em toda a peça, sombra de contato bem definida.",
    version: "1.0.0",
  },
  {
    id: "cinema",
    name: "Cinematográfico noturno",
    fragment:
      "Enquadramento cinematográfico noturno, hora azul, luzes práticas quentes ao fundo, contraste alto, halação sutil nas fontes de luz, textura de filme 35mm, proporção anamórfica.",
    version: "1.0.0",
  },
  {
    id: "ilustracao",
    name: "Ilustração editorial",
    fragment:
      "Ilustração editorial em vetor, formas geométricas simplificadas, paleta de três cores, textura granulada leve, sem contorno preto, composição centrada e simétrica.",
    version: "1.0.0",
  },
  {
    id: "minimalismo",
    name: "Minimalismo de marca",
    fragment:
      "Composição minimalista de marca, muito espaço negativo, um único elemento em foco, paleta monocromática, iluminação plana e uniforme, acabamento fosco, sem adornos.",
    version: "1.0.0",
  },
  {
    id: "render",
    name: "3D suave",
    fragment:
      "Render 3D com materiais foscos, iluminação global suave, sombras difusas e longas, paleta pastel, cantos arredondados, fundo em cor sólida, sem reflexos especulares fortes.",
    version: "1.0.0",
  },
];

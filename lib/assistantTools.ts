/* ============================================================
   AS FERRAMENTAS DO ASSISTENTE — um esquema, dois dialetos

   Até a leva 6 o assistente era texto puro. Agora ele escreve no grafo
   do projeto aberto: cria nó, liga nó, define prompt e modelo, e monta
   um fluxo inteiro de uma vez.

   O esquema mora aqui, num lugar só, porque três consumidores precisam
   dele e discordar entre eles seria um erro silencioso:

     `app/api/assistant/route.ts`   declara as ferramentas ao provedor
     `lib/projetoFluxo.ts`          executa a chamada no `space`
     o painel                       narra o que foi feito

   ── Por que dois dialetos ──
   A mesma rota fala com três upstreams. A API de mensagens da Anthropic
   quer `{name, description, input_schema}`; a compatível com OpenAI
   (Azure, Gemini e GPT pela Kie) quer
   `{type:"function", function:{name, description, parameters}}`. É a
   MESMA declaração em duas embalagens — por isso a fonte é uma só e as
   embalagens são derivadas, nunca escritas à mão.

   ── O que NÃO está aqui ──
   Nenhuma ferramenta gera mídia. A IA monta; quem decide executar é a
   pílula de modo de execução. Uma ferramenta `gerar` seria um segundo
   lugar para essa decisão, que é exatamente o que a leva proíbe.
   ============================================================ */

/** Os tipos de nó que a IA pode criar. A verdade é `lib/nodeTypes.tsx`;
    esta lista é o subconjunto que faz sentido a IA montar sozinha —
    `groupNode` é moldura de seleção e `assistantNode` é o próprio
    assistente, que ele não deve replicar dentro do grafo. */
export const TIPOS_PARA_IA = [
  "promptNode",
  "imageInputNode",
  "videoInputNode",
  "generateNode",
  "videoGeneratorNode",
  "commentNode",
] as const;

export type TipoParaIA = (typeof TIPOS_PARA_IA)[number];

/** As entradas que uma aresta pode alcançar. São as chaves de
    `EDGE_COLORS` em `lib/edgeStyles.ts`, menos `default`: quem pinta a
    aresta é o nome da entrada, então um nome fora desta lista sai cinza
    e denuncia o erro. */
export const ENTRADAS = [
  "prompt",
  "image",
  "startFrame",
  "endFrame",
  "resource",
  "videoRef",
  "referenceVideo",
  "audioRef",
  "character",
] as const;

export type Entrada = (typeof ENTRADAS)[number];

type Esquema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type Ferramenta = {
  nome: string;
  descricao: string;
  esquema: Esquema;
};

export const FERRAMENTAS: Ferramenta[] = [
  {
    nome: "criar_no",
    descricao:
      "Cria um nó no grafo do projeto aberto. Use para acrescentar uma peça de cada vez. " +
      "Para um fluxo inteiro de imagem para vídeo, prefira montar_fluxo_imagem_video, que " +
      "posiciona e liga tudo de uma vez. O nó nasce parado: criar não gera nada.",
    esquema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: [...TIPOS_PARA_IA],
          description:
            "promptNode = texto que alimenta outro nó. imageInputNode / videoInputNode = " +
            "arquivo de entrada. generateNode = gerador de imagem. videoGeneratorNode = " +
            "gerador de vídeo. commentNode = nota.",
        },
        prompt: {
          type: "string",
          description: "O texto do nó. Vale para promptNode, generateNode e videoGeneratorNode.",
        },
        modelo: {
          type: "string",
          description:
            "Id do modelo, exatamente como aparece na lista de modelos disponíveis do contexto. " +
            "Só para generateNode e videoGeneratorNode.",
        },
        proporcao: { type: "string", description: "Proporção, por exemplo 16:9 ou 9:16." },
        ref: {
          type: "string",
          description:
            "Um apelido seu para este nó (por exemplo 'img1', 'vid1', 'txt_img1'), para usá-lo " +
            "em conectar e definir_no NO MESMO TURNO, antes de saber o id real. Monte o fluxo " +
            "inteiro numa leva só: criar_no com ref, depois conectar pelos refs.",
        },
        x: { type: "number", description: "Posição no grafo. Omita para deixar o app posicionar." },
        y: { type: "number", description: "Posição no grafo. Omita para deixar o app posicionar." },
      },
      required: ["tipo"],
      additionalProperties: false,
    },
  },
  {
    nome: "conectar",
    descricao:
      "Liga a saída de um nó a uma entrada de outro. Aceita, em 'de' e 'para': o id de um nó " +
      "do contexto, um ref dado em criar_no/usar_anexo nesta mesma leva, ou o rótulo de um " +
      "anexo ('@foto 1') — neste caso o anexo entra no grafo sozinho, sem precisar de usar_anexo.",
    esquema: {
      type: "object",
      properties: {
        de: { type: "string", description: "Id, ref ou '@foto N' do nó de origem." },
        para: { type: "string", description: "Id ou ref do nó de destino." },
        entrada: {
          type: "string",
          enum: [...ENTRADAS],
          description:
            "Qual entrada do destino recebe a ligação. prompt = texto. image = imagem de " +
            "referência de um gerador de imagem. startFrame = primeiro quadro de um vídeo.",
        },
      },
      required: ["de", "para", "entrada"],
      additionalProperties: false,
    },
  },
  {
    nome: "definir_no",
    descricao:
      "Muda o prompt, o modelo ou os parâmetros de um nó que já existe. Não cria nada e não gera nada.",
    esquema: {
      type: "object",
      properties: {
        no: { type: "string", description: "Id do nó, ou o ref dado em criar_no nesta leva." },
        prompt: { type: "string" },
        modelo: { type: "string", description: "Id do modelo, como no contexto." },
        proporcao: { type: "string" },
        duracao: { type: "number", description: "Duração em segundos, só para vídeo." },
        som: { type: "boolean", description: "Só para vídeo, nos modelos que têm áudio." },
      },
      required: ["no"],
      additionalProperties: false,
    },
  },
  {
    nome: "montar_fluxo_imagem_video",
    descricao:
      "Monta de uma vez um fluxo completo de imagem para vídeo, com N ramos paralelos. " +
      "Cada ramo é: texto → gerador de imagem → gerador de vídeo, mais um texto próprio " +
      "para o vídeo. É o pedido de uma frase: 'monte um fluxo de 4 vídeos a partir de 4 " +
      "imagens'. Monta e para: nada é gerado.",
    esquema: {
      type: "object",
      properties: {
        quantidade: {
          type: "number",
          description: "Quantos ramos paralelos. De 1 a 8.",
        },
        prompts_imagem: {
          type: "array",
          items: { type: "string" },
          description:
            "Um prompt de imagem por ramo, na ordem. Se vierem menos que a quantidade, os " +
            "que faltam ficam vazios para o usuário escrever.",
        },
        prompts_video: {
          type: "array",
          items: { type: "string" },
          description: "Um prompt de vídeo por ramo, na ordem. Mesma regra.",
        },
        modelo_imagem: { type: "string", description: "Id do modelo de imagem." },
        modelo_video: { type: "string", description: "Id do modelo de vídeo." },
        proporcao: { type: "string", description: "Proporção dos dois geradores, por exemplo 9:16." },
        referencias: {
          type: "array",
          items: { type: "string" },
          description:
            "Um rótulo de anexo por ramo, na ordem (por exemplo 'foto 1'). O anexo vira um nó " +
            "de imagem ligado à entrada 'image' do gerador de imagem daquele ramo, para o " +
            "produto/personagem da foto ser preservado. Use o mesmo rótulo em vários ramos " +
            "quando todos partem da mesma foto. Vazio ou omitido = ramo sem referência.",
        },
      },
      required: ["quantidade"],
      additionalProperties: false,
    },
  },
  {
    nome: "usar_anexo",
    descricao:
      "Põe no grafo uma foto ou vídeo que o usuário anexou no chat (o contexto lista os " +
      "rótulos: 'foto 1', 'video 1'…). Devolve o id do nó criado — ou o do nó que já existia, " +
      "se o mesmo anexo já estiver no grafo. Depois ligue esse id com conectar: 'image' de um " +
      "gerador de imagem para preservar o produto; 'startFrame' de um gerador de vídeo para " +
      "a foto ser o primeiro quadro; 'referenceVideo'/'videoRef' para um vídeo de referência.",
    esquema: {
      type: "object",
      properties: {
        anexo: {
          type: "string",
          description: "O rótulo do anexo, exatamente como no contexto: 'foto 1', 'video 2'.",
        },
        ref: {
          type: "string",
          description: "Um apelido seu para o nó criado, para usar em conectar no mesmo turno.",
        },
      },
      required: ["anexo"],
      additionalProperties: false,
    },
  },
];

/** Embalagem da API de mensagens da Anthropic. */
export function ferramentasAnthropic(chat = false) {
  return (chat ? FERRAMENTAS_CHAT : FERRAMENTAS).map((f) => ({
    name: f.nome,
    description: f.descricao,
    input_schema: f.esquema,
  }));
}

/** Embalagem compatível com OpenAI — Azure, Gemini e GPT pela Kie. */
export function ferramentasOpenAI(chat = false) {
  return (chat ? FERRAMENTAS_CHAT : FERRAMENTAS).map((f) => ({
    type: "function" as const,
    function: {
      name: f.nome,
      description: f.descricao,
      parameters: f.esquema,
    },
  }));
}

/** O chat cria seus próprios projetos; o painel continua restrito ao grafo aberto. */
export const FERRAMENTAS_CHAT: Ferramenta[] = [
  ...FERRAMENTAS,
  {
    nome: "criar_workflow",
    descricao: "Cria um workflow vazio vinculado a esta conversa. Chame antes de montar o primeiro fluxo. Depois use criar_no, conectar ou montar_fluxo_imagem_video. Só crie outro quando o usuário pedir um novo workflow.",
    esquema: { type: "object", properties: { nome: { type: "string", minLength: 1, maxLength: 100 } }, required: ["nome"], additionalProperties: false },
  },
  {
    nome: "criar_personagem",
    descricao: "Salva um personagem na biblioteca e inicia seu retrato real por IA. Use gerar_retrato=false somente se o usuário pedir apenas a ficha. A geração é assíncrona e consome créditos Kie.ai. Nunca diga que a imagem está pronta quando apenas foi iniciada.",
    esquema: {
      type: "object",
      properties: {
        nome: { type: "string", minLength: 1, maxLength: 100 },
        descricao: { type: "string", minLength: 10, maxLength: 4000, description: "Identidade, aparência, idade adulta, cabelo, roupa e estilo visual." },
        ambiente: { type: "string", maxLength: 1000 },
        gerar_retrato: { type: "boolean" },
      },
      required: ["nome", "descricao"], additionalProperties: false,
    },
  },
];

import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./store";
import { edgeStyle } from "./edgeStyles";
import { promptTrocaDePessoa } from "./ugcPromptKit";

// ── UGC starter: 4× Image Gen → 4× Video Gen ─────────────────────────────────
// Two independent columns, each stacked vertically:
//
//   T5   T6   T7   T8    ← y=-150  (video prompt above its video gen)
//   VG1  VG2  VG3  VG4   ← y=0
//
//   IG1  IG2  IG3  IG4   ← y=620   (images pre-loaded as "done")
//   T1   T2   T3   T4    ← y=1200  (image prompt below its image gen)
//
// Connections:
//   T[1-4] → IG[1-4].prompt
//   IG[1-4] → VG[1-4].startFrame
//   T[5-8]  → VG[1-4].prompt

const STRIDE_X = 380;
const X_OFFSET = 310;

const REF_IMAGES = [
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/1.png",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/2.png",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/3.png",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/4.png",
];

const REF_VIDEOS = [
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/1.mp4",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/2.mp4",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/3.mp4",
  "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/4.mp4",
];

const IMG_PROMPTS = [
  "A photorealistic portrait. It features the specific young woman  She is relaxing leisurely in a luxurious overwater bungalow cabana in the Maldives. She is lying back on white linen cushions, looking calmly out over a stunning turquoise infinity pool that seamlessly merges with the clear ocean. She wears an elegant black swimsuit (consistent with her classy aesthetic) and her signature gold hoop earrings. She is looking toward the camera with a peaceful, knowing expression of automated income/freedom. Bright, sunny natural lighting; shallow depth of field focusing sharply on her face and expression. She seats if front of the camera, to speak for a vlog",
  "A photorealistic medium close-up shot. It features the specific young woman. She is seated comfortably and elegantly inside a luxurious First-Class airplane suite (Emirates A380 style), featuring rich wood paneling and gold accents.  Her signature gold jewelry and a refined black top are visible. Soft, diffused daylight from the aircraft windows illuminates her features. The shot emphasizes productiveness within high luxury. She seats if front of the camera, to speak for a vlog. I want the girl to hold the camera in selfie mode like. No overlay ",
  "A photorealistic close-up portrait. View from inside the car, smiling girl. It features the specific young woman. She is seated in the driver's seat of a high-end luxury supercar (like a Lamborghini Aventador). She is looking directly and intensely at the camera with an expression of urgency and focused determination. She wears the black top and gold hoop earrings. The interior of the car is dark, accented by dramatic red and blue LED dashboard lights and the ambient glow of passing city lights reflecting on the windshield. Cinematic lighting, dramatic shadows on her face, shallow depth of field, sharp focus on the eyes",
  "A photorealistic, cinematic close-up shot, serving as the first frame of a video. It features the specific young woman .  She is seated at a table in a stylish, modern restaurant. A smartphone is placed on a small tripod on the table directly in front of her, filming in vlog style.  She looks directly into the camera with a confident, engaging expression, about to speak. Her posture is relaxed yet intentional, as if recording a personal vlog.  The background shows a softly blurred restaurant ambiance: warm lighting, subtle movement, tables, and guests out of focus, creating a cozy, premium atmosphere with bokeh highlights.  Lighting: Warm, natural indoor lighting with soft highlights on her face and gentle shadows. Skin texture remains natural and detailed.  Camera & framing: Close-up shot, eye-level angle Camera is static on the tripod (no movement) Slight natural micro-movements from the subject (breathing, minimal head motion) High depth of field on the face, background softly blurred  Do not alter facial proportions, eye shape, or hairstyle.  Visual quality: Ultra-realistic, cinematic rendering 4K resolution, ultra HD Sharp focus on subject, rich details Natural colors, balanced contrast Professional vlog-style aesthetic",
];

const VID_PROMPTS = [
  `Static, locked-off shot using the exact same framing as the reference  @Image Generator #1 .
Do not alter facial proportions, eye shape, or hairstyle.
Subject faces the camera directly in a vlog style.

Natural skin texture, soft highlights, and subtle shadows.

She speaks directly to the camera with a calm, confident, and slightly persuasive tone:
"You officially have zero excuses left not to make content. Why? Because I'm not even real. I'm an AI avatar created by Ramzi, and this is the exact workflow to make videos just like this."

Micro-expressions:
Slight eyebrow raise on each key clause
Controlled pauses between sentences
Brief stillness of the face during pauses for emphasis

Camera remains completely stable (no movement, no zoom).
No changes in framing throughout the clip.
Visual quality:
4K resolution, ultra HD
Sharp clarity with cinematic texture
Natural colors, balanced contrast
Professional, stable image with high detail`,

  `Handheld selfie shot, subject holding the phone at arm's length in vertical framing.
Natural micro-movements from the hand (very subtle sway, slight breathing motion), maintaining a stable and clean composition.
Framing remains consistent with the reference image (same angle, same composition).
Do not alter facial proportions, eye shape, or hairstyle.
Subject looks directly into the camera in a vlog-style setup.
Natural skin texture, soft highlights, and subtle shadows.
She speaks directly to the camera with a calm, confident, smiling, and slightly persuasive tone:
"First, get a photo of your AI avatar.
Second, write a prompt to place your avatar anywhere—like a private jet, or wherever you want.
Third, add a short script… and generate multiple videos in seconds."
Micro-expressions:
Slight eyebrow raise on each key clause
Controlled pauses between sentences
Brief stillness of the face during pauses for emphasis
Camera behavior:
Handheld selfie mode
Subtle natural micro-movements (no jitter, no aggressive shake)
No zoom or reframing
Visual quality:
4K resolution, ultra HD
Sharp clarity with cinematic texture
Natural colors, balanced contrast
Professional, clean image with high detail`,

  `Handheld shot filmed by another person, camera positioned at eye level.
only the girl is visible.
Slight natural handheld micro-movements (very subtle sway, no shake or jitter).
Framing remains consistent throughout the clip (no zoom, no reframing).
Do not alter facial proportions, eye shape, or hairstyle.
Natural skin texture, soft highlights, and gentle shadows.

She looks directly into the camera, speaking with a confident, clear, and slightly persuasive tone:
"You now have the ultimate workflow to post a brand new video every single day.
Pick your niche, generate your AI video, and let the system do the heavy lifting for your brand."
Micro-expressions:
Subtle eyebrow lift on key phrases
Light smile to convey confidence and ease
Natural pauses between sentences
Minimal head movement for realism
Camera behavior:
Handheld by another person
Slight micro-movements only (no aggressive motion)
Stable, professional feel
Visual quality:
4K resolution, ultra HD
Sharp clarity with cinematic texture
Natural colors, balanced contrast
High detail, clean and professional image`,

  `Handheld shot filmed by another person, camera positioned at eye level.
only the girl is visible.
Slight natural handheld micro-movements (very subtle sway, no shake or jitter).
Framing remains consistent throughout the clip (no zoom, no reframing).
Do not alter facial proportions, eye shape, or hairstyle.
Natural skin texture, soft highlights, and gentle shadows.

The girl is approaching her head to the camera during one second like she just noticed that she is filmed. And she says :
"This is exactly how you bring in views, leads, and paying clients on autopilot. The tools are right here. Comment AI if you want to make videos like this"

Micro-expressions:
Subtle eyebrow lift on key phrases
Light smile to convey confidence and ease
Natural pauses between sentences
Minimal head movement for realism
Camera behavior:
Handheld by another person
Slight micro-movements only (no aggressive motion)
Stable, professional feel
Visual quality:
4K resolution, ultra HD
Sharp clarity with cinematic texture
Natural colors, balanced contrast
High detail, clean and professional image`,
];

export function makeUGCTemplate(): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeCounters: Record<string, number>;
} {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  for (let i = 0; i < 4; i++) {
    const base = i * STRIDE_X;
    const ptImgId = `tpl-pt-${i + 1}`;
    const igId = `tpl-ig-${i + 1}`;
    const ptVidId = `tpl-pv-${i + 1}`;
    const vgId = `tpl-vg-${i + 1}`;

    // Text node for video gen — sits above its video gen node
    nodes.push({
      id: ptVidId,
      type: "promptNode",
      position: { x: base + X_OFFSET * 2, y: -430 },
      style: { width: 260, height: 390 },
      data: { label: `Text #${i + 5}`, status: "idle", prompt: VID_PROMPTS[i] },
    });

    // Video gen node — seedance-2, 9:16, 1080p, sound on
    nodes.push({
      id: vgId,
      type: "videoGeneratorNode",
      position: { x: base + X_OFFSET * 2, y: 0 },
      style: { width: 320, height: 220 },
      data: {
        label: `Video Generator #${i + 1}`,
        status: "done",
        videoModel: "seedance-2",
        aspectRatio: "9:16",
        grokResolution: "1080p",
        sound: true,
        videoUrl: REF_VIDEOS[i],
      },
    });

    // Image gen node — image pre-loaded as a "done" output so the node
    // displays the image and the startFrame edge carries the URL.
    nodes.push({
      id: igId,
      type: "generateNode",
      position: { x: base, y: 620 },
      style: { width: 280, height: 280 },
      data: {
        label: `Image Generator #${i + 1}`,
        status: "done",
        model: "nano-banana-pro",
        aspectRatio: "9:16",
        quality: "2k",
        imageUrl: REF_IMAGES[i],
        r2Url: REF_IMAGES[i],
      },
    });

    // Text node for image gen — sits below its image gen node
    nodes.push({
      id: ptImgId,
      type: "promptNode",
      position: { x: base, y: 1200 },
      style: { width: 260, height: 390 },
      data: { label: `Text #${i + 1}`, status: "idle", prompt: IMG_PROMPTS[i] },
    });

    edges.push({
      id: `tpl-e-pt${i + 1}-ig${i + 1}`,
      source: ptImgId,
      target: igId,
      targetHandle: "prompt",
      animated: false,
      style: edgeStyle("prompt"),
    });

    edges.push({
      id: `tpl-e-ig${i + 1}-vg${i + 1}`,
      source: igId,
      target: vgId,
      targetHandle: "startFrame",
      animated: false,
      style: edgeStyle("startFrame"),
    });

    edges.push({
      id: `tpl-e-pv${i + 1}-vg${i + 1}`,
      source: ptVidId,
      target: vgId,
      targetHandle: "prompt",
      animated: false,
      style: edgeStyle("prompt"),
    });
  }

  // ── Avatar image asset node — single source connected to all 4 IG ref inputs ──
  const avatarId = "tpl-avatar";
  nodes.push({
    id: avatarId,
    type: "imageInputNode",
    position: { x: -380, y: 160 },
    style: { width: 260 },
    data: {
      label:             "Avatar",
      status:            "idle",
      r2Url:             "https://pub-73a59b956f1c4a7db2934522c13d8027.r2.dev/workflow-template/avatar.png",
      imageNaturalRatio: "9 / 16",
    },
  });

  for (let i = 0; i < 4; i++) {
    edges.push({
      id: `tpl-e-avatar-ig${i + 1}`,
      source: avatarId,
      target: `tpl-ig-${i + 1}`,
      targetHandle: "image",
      animated: false,
      style: edgeStyle("image"),
    });
  }

  return {
    nodes,
    edges,
    nodeCounters: { promptNode: 8, generateNode: 4, videoGeneratorNode: 4, imageInputNode: 1 },
  };
}


// ── Trocar a pessoa do vídeo: vídeo de referência + Seedance 2.5 Edit ─────────
// A receita do @ViralOps_ (bônus): um vídeo existente vira referência de
// movimento e cena, e o prompt diz só a troca — o que muda, qual referência
// substitui, o que fica igual. Nada vem preenchido: o usuário solta o vídeo
// e as fotos nos nós de entrada, e os "@" do prompt são os rótulos deles.
//
//   [Vídeo de referência] ──referenceVideo──┐
//   [Personagem] ──resource──┐              ├→ [Seedance 2.5 Edit]
//   [Produto]    ──resource──┤              │
//   [Text] ──prompt──────────┴──────────────┘
//
// O nó do produto é opcional: sem imagem nele, o "@Produto" do prompt fica
// como texto e o modelo ignora; o comentário ao lado explica isso ao usuário.

export const TROCA_PESSOA_TEMPLATE_NAME = "Trocar a pessoa do vídeo";

export function makeTrocaPessoaTemplate(): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeCounters: Record<string, number>;
} {
  const ROTULO_PESSOA = "Personagem";
  const ROTULO_PRODUTO = "Produto";
  const ROTULO_VIDEO = "Vídeo de referência";

  const nodes: Node<NodeData>[] = [
    {
      id: "tp-comment",
      type: "commentNode",
      position: { x: 0, y: -260 },
      style: { width: 560, height: 200 },
      data: {
        label: "Comment #1",
        status: "idle",
        comment: [
          "TROCAR A PESSOA DO VÍDEO",
          "1. Solte o vídeo que serve de referência no nó de vídeo (movimento, câmera e cena vêm dele).",
          "2. Solte a foto do seu personagem em \"Personagem\".",
          "3. \"Produto\" é opcional: sem foto, apague a linha do produto no prompt.",
          "4. O prompt diz só o que muda e o que fica igual. Ajuste a fala (instante e texto) e gere.",
        ].join("\n"),
      },
    },
    {
      id: "tp-video",
      type: "videoInputNode",
      position: { x: 0, y: 0 },
      style: { width: 220 },
      data: { label: ROTULO_VIDEO, status: "idle" },
    },
    {
      id: "tp-pessoa",
      type: "imageInputNode",
      position: { x: 0, y: 300 },
      style: { width: 200 },
      data: { label: ROTULO_PESSOA, status: "idle" },
    },
    {
      id: "tp-produto",
      type: "imageInputNode",
      position: { x: 0, y: 540 },
      style: { width: 200 },
      data: { label: ROTULO_PRODUTO, status: "idle" },
    },
    {
      id: "tp-prompt",
      type: "promptNode",
      position: { x: 320, y: 300 },
      style: { width: 380, height: 400 },
      data: {
        label: "Text #1",
        status: "idle",
        prompt: promptTrocaDePessoa({
          personagem: ROTULO_PESSOA,
          produtos: [ROTULO_PRODUTO],
          falas: [{ em: 3, texto: "Gente... eu amei esse produto." }],
        }),
      },
    },
    {
      id: "tp-video-gen",
      type: "videoGeneratorNode",
      position: { x: 780, y: 0 },
      style: { width: 320, height: 220 },
      data: {
        label: "Video Generator #1",
        status: "idle",
        videoModel: "seedance-2-5-edit",
        aspectRatio: "adaptive",
        sound: true,
      },
    },
  ];

  const edges: Edge[] = [
    { id: "tp-e-video", source: "tp-video", target: "tp-video-gen", targetHandle: "referenceVideo", animated: false, style: edgeStyle("referenceVideo") },
    { id: "tp-e-pessoa", source: "tp-pessoa", target: "tp-video-gen", targetHandle: "resource", animated: false, style: edgeStyle("resource") },
    { id: "tp-e-produto", source: "tp-produto", target: "tp-video-gen", targetHandle: "resource", animated: false, style: edgeStyle("resource") },
    { id: "tp-e-prompt", source: "tp-prompt", target: "tp-video-gen", targetHandle: "prompt", animated: false, style: edgeStyle("prompt") },
  ];

  return {
    nodes,
    edges,
    nodeCounters: { commentNode: 1, videoInputNode: 1, imageInputNode: 2, promptNode: 1, videoGeneratorNode: 1 },
  };
}

// ── Templates de nicho para postar: gancho nos 3s, CTA no final, 9:16 ────────
// Mesma receita da troca de pessoa/produto acima (vídeo de referência + Seedance
// 2.5 Edit): o que muda de um nicho para outro é o comentário de instruções e o
// prompt já roteirizado com duas falas — o gancho logo no início e o CTA perto
// do fim. O usuário traz o vídeo de referência (com essa estrutura de post) e as
// fotos do personagem/produto; nenhum node novo, nenhum handle novo.

interface NichoConfig {
  idPrefix: string;
  tituloComentario: string;
  linhasComentario: string[];
  /** Um rótulo = produto único (opcional, se assim indicado no comentário).
   * Dois rótulos = comparação lado a lado, ambos esperados. */
  rotuloProdutos: string[];
  hook: string;
  cta: string;
  ctaSegundoSugerido: number;
}

function makeNichoTemplate(cfg: NichoConfig): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeCounters: Record<string, number>;
} {
  const ROTULO_PESSOA = "Personagem";
  const ROTULO_VIDEO = "Vídeo de referência";
  const id = (n: string) => `${cfg.idPrefix}-${n}`;

  const nodes: Node<NodeData>[] = [
    {
      id: id("comment"),
      type: "commentNode",
      position: { x: 0, y: -320 },
      style: { width: 580, height: 280 },
      data: {
        label: "Comment #1",
        status: "idle",
        comment: [
          cfg.tituloComentario,
          ...cfg.linhasComentario,
          `4. O prompt já vem com gancho (2s) e CTA (${cfg.ctaSegundoSugerido}s) de exemplo — ajuste os textos e mova o segundo do CTA para os últimos segundos do SEU vídeo de referência.`,
        ].join("\n"),
      },
    },
    { id: id("video"), type: "videoInputNode", position: { x: 0, y: 0 }, style: { width: 220 }, data: { label: ROTULO_VIDEO, status: "idle" } },
    { id: id("pessoa"), type: "imageInputNode", position: { x: 0, y: 300 }, style: { width: 200 }, data: { label: ROTULO_PESSOA, status: "idle" } },
    ...cfg.rotuloProdutos.map((rotulo, i): Node<NodeData> => ({
      id: id(`produto-${i + 1}`), type: "imageInputNode", position: { x: 0, y: 540 + i * 240 }, style: { width: 200 }, data: { label: rotulo, status: "idle" },
    })),
    {
      id: id("prompt"),
      type: "promptNode",
      position: { x: 320, y: 300 },
      style: { width: 380, height: 460 },
      data: {
        label: "Text #1",
        status: "idle",
        prompt: promptTrocaDePessoa({
          personagem: ROTULO_PESSOA,
          produtos: cfg.rotuloProdutos,
          falas: [{ em: 2, texto: cfg.hook }, { em: cfg.ctaSegundoSugerido, texto: cfg.cta }],
        }),
      },
    },
    {
      id: id("video-gen"),
      type: "videoGeneratorNode",
      position: { x: 780, y: 0 },
      style: { width: 320, height: 220 },
      data: { label: "Video Generator #1", status: "idle", videoModel: "seedance-2-5-edit", aspectRatio: "adaptive", sound: true },
    },
  ];

  const edges: Edge[] = [
    { id: id("e-video"), source: id("video"), target: id("video-gen"), targetHandle: "referenceVideo", animated: false, style: edgeStyle("referenceVideo") },
    { id: id("e-pessoa"), source: id("pessoa"), target: id("video-gen"), targetHandle: "resource", animated: false, style: edgeStyle("resource") },
    ...cfg.rotuloProdutos.map((_, i) => ({ id: id(`e-produto-${i + 1}`), source: id(`produto-${i + 1}`), target: id("video-gen"), targetHandle: "resource", animated: false, style: edgeStyle("resource") })),
    { id: id("e-prompt"), source: id("prompt"), target: id("video-gen"), targetHandle: "prompt", animated: false, style: edgeStyle("prompt") },
  ];

  return {
    nodes,
    edges,
    nodeCounters: { commentNode: 1, videoInputNode: 1, imageInputNode: 1 + cfg.rotuloProdutos.length, promptNode: 1, videoGeneratorNode: 1 },
  };
}

export const FITNESS_TEMPLATE_NAME = "TikTok Fitness";
export function makeFitnessTemplate() {
  return makeNichoTemplate({
    idPrefix: "nf",
    tituloComentario: "TIKTOK FITNESS — gancho + CTA, 15-60s, 9:16",
    linhasComentario: [
      "1. Solte um vídeo de referência de fitness (treino, transformação, rotina) com gancho forte no início.",
      "2. Solte a foto do seu personagem em \"Personagem\".",
      "3. \"Suplemento\" é opcional: sem foto, apague a linha do produto no prompt.",
    ],
    rotuloProdutos: ["Suplemento"],
    hook: "Gente, para de rolar o feed... isso aqui mudou meu treino.",
    cta: "Link na bio pra você começar hoje.",
    ctaSegundoSugerido: 15,
  });
}

export const BELEZA_TEMPLATE_NAME = "TikTok Beleza";
export function makeBelezaTemplate() {
  return makeNichoTemplate({
    idPrefix: "nb",
    tituloComentario: "TIKTOK BELEZA — gancho + CTA, 15-60s, 9:16",
    linhasComentario: [
      "1. Solte um vídeo de referência de beleza (rotina, resultado, antes/depois) com gancho forte no início.",
      "2. Solte a foto do seu personagem em \"Personagem\".",
      "3. \"Produto\" é opcional: sem foto, apague a linha do produto no prompt.",
    ],
    rotuloProdutos: ["Produto de beleza"],
    hook: "Minha pele nunca ficou assim tão rápido.",
    cta: "Corre lá no link da bio antes que esgote.",
    ctaSegundoSugerido: 15,
  });
}

export const UNBOXING_TEMPLATE_NAME = "TikTok Unboxing de Tecnologia";
export function makeUnboxingTemplate() {
  return makeNichoTemplate({
    idPrefix: "nu",
    tituloComentario: "TIKTOK UNBOXING DE TECNOLOGIA — gancho + CTA, 15-60s, 9:16",
    linhasComentario: [
      "1. Solte um vídeo de referência de unboxing (abrir caixa, primeiro contato com o gadget) com gancho forte no início.",
      "2. Solte a foto do seu personagem em \"Personagem\".",
      "3. Solte a foto do gadget em \"Gadget\" — aqui o produto é o centro do vídeo, não é opcional.",
    ],
    rotuloProdutos: ["Gadget"],
    hook: "Chegou o gadget que todo mundo tá comentando.",
    cta: "Deixei o link certinho pra você garantir o seu.",
    ctaSegundoSugerido: 15,
  });
}

export const DEPOIMENTO_TEMPLATE_NAME = "TikTok Depoimento";
export function makeDepoimentoTemplate() {
  return makeNichoTemplate({
    idPrefix: "nd",
    tituloComentario: "TIKTOK DEPOIMENTO / PROVA SOCIAL — gancho + CTA, 15-60s, 9:16",
    linhasComentario: [
      "1. Solte um vídeo de referência de depoimento (alguém contando um resultado/experiência) com gancho forte no início.",
      "2. Solte a foto do seu personagem em \"Personagem\".",
      "3. \"Produto\" é opcional: sem foto, apague a linha do produto no prompt.",
    ],
    rotuloProdutos: ["Produto"],
    hook: "Eu quase não acreditei no resultado disso aqui.",
    cta: "Se quiser o mesmo resultado, o link tá na bio.",
    ctaSegundoSugerido: 15,
  });
}

export const COMPARACAO_TEMPLATE_NAME = "TikTok Comparação de Produto";
export function makeComparacaoTemplate() {
  return makeNichoTemplate({
    idPrefix: "nc",
    tituloComentario: "TIKTOK COMPARAÇÃO DE PRODUTO — gancho + CTA, 15-60s, 9:16",
    linhasComentario: [
      "1. Solte um vídeo de referência que já compara dois itens lado a lado, com gancho forte no início.",
      "2. Solte a foto do seu personagem em \"Personagem\".",
      "3. Solte as fotos dos dois produtos em \"Produto A\" e \"Produto B\" — os dois são esperados aqui, a comparação é o vídeo inteiro.",
    ],
    rotuloProdutos: ["Produto A", "Produto B"],
    hook: "Todo mundo pergunta qual desses dois vale mais a pena.",
    cta: "Eu deixo o meu favorito linkado na bio.",
    ctaSegundoSugerido: 15,
  });
}

// ── TikTok Live — apoio para uma live de verdade, não automação ─────────────
// Isto é DIFERENTE dos templates de post acima: não gera um clipe pronto pra
// postar, gera (1) um loop de vitrine de produto para tocar como fundo/janela
// secundária ENQUANTO o host está pessoalmente ao vivo, e (2) um roteiro
// pronto pra servir de teleprompter manual. De propósito, NÃO reproduz o
// padrão do "LIVE IA" (extensão que toca vídeo em loop sozinha, simulando
// presença humana) — o TikTok exige presença humana real para os recursos de
// monetização de live, e automação desse tipo é risco real de banimento.

export const LIVE_TEMPLATE_NAME = "TikTok Live — Apoio (não automação)";

const ROTEIRO_LIVE = [
  "ROTEIRO PARA A SUA LIVE NO TIKTOK — leia e adapte antes de ir ao ar.",
  "Isto é para você seguir enquanto está PESSOALMENTE ao vivo, respondendo ao chat em tempo real — não é para tocar sozinho no seu lugar.",
  "",
  "ABERTURA (primeiros 30s, gancho pra quem acabou de entrar)",
  "\"Oi, gente! Que bom que você chegou agora — fica só mais um minuto que eu vou mostrar uma coisa que vocês vão amar.\"",
  "[Cumprimente quem está chegando pelo nome quando aparecer no chat.]",
  "",
  "APRESENTAÇÃO DO PRODUTO",
  "\"Esse aqui é o [PRODUTO]. Deixa eu mostrar de perto...\"",
  "[Mostre o produto físico na câmera, vire pra mostrar todos os ângulos.]",
  "",
  "PROVA SOCIAL",
  "\"Muita gente que já comprou voltou pra contar que [RESULTADO/BENEFÍCIO REAL].\"",
  "[Leia um comentário/depoimento real se tiver print salvo.]",
  "",
  "OFERTA E URGÊNCIA (repita a cada poucos minutos)",
  "\"Só durante a live, [OFERTA/DESCONTO]. Depois que eu sair do ar, volta ao preço normal.\"",
  "",
  "TRATANDO OBJEÇÕES (tenha 2-3 prontas)",
  "\"Pergunta que sempre chega: [OBJEÇÃO COMUM]. Na real, [RESPOSTA CURTA E HONESTA].\"",
  "",
  "CHAMADA PRA SEGUIR E COMPARTILHAR (repita)",
  "\"Se você tá gostando, segue aqui e manda pra um amigo que ia curtir isso também.\"",
  "",
  "ENCERRAMENTO",
  "\"Valeu por ficar comigo até aqui! Quem quiser garantir o [PRODUTO], o link tá fixado. Te vejo na próxima live!\"",
  "",
  "DICA: mantenha esse roteiro como guia, não como texto decorado — a live fica melhor quando você conversa de verdade com quem está assistindo.",
].join("\n");

const PROMPT_VITRINE_LIVE = [
  "A clean, professional product showcase loop for a live-stream backdrop.",
  "The product from the reference photo sits on a simple pedestal with soft studio lighting and a softly blurred neutral background.",
  "The camera slowly orbits 360 degrees around the product at a constant height and speed, starting and ending at the exact same angle and framing so the clip loops seamlessly when played on repeat.",
  "No cuts, no zoom changes, no text overlays, no people, no logos beyond what is already on the product. Smooth, continuous, hypnotic motion.",
].join(" ");

export function makeLiveTemplate(): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeCounters: Record<string, number>;
} {
  const nodes: Node<NodeData>[] = [
    {
      id: "live-comment-aviso",
      type: "commentNode",
      position: { x: 0, y: -600 },
      style: { width: 1100, height: 180 },
      data: {
        label: "Comment #1",
        status: "idle",
        comment: [
          "APOIO PARA LIVE NO TIKTOK — isto NÃO é um vídeo pronto pra postar nem uma live automática.",
          "1. \"Vitrine em loop\" (abaixo): solte a foto do seu produto e gere um vídeo curto que gira 360° e volta ao ponto de partida — toque isso como FUNDO/vitrine numa janela secundária ENQUANTO você está pessoalmente ao vivo, respondendo ao chat.",
          "2. \"Roteiro da live\" (ao lado): pronto pra você ler/adaptar antes de entrar ao vivo — funciona como teleprompter manual.",
          "3. NUNCA toque só a vitrine em loop sozinha no lugar de uma live de verdade: o TikTok exige presença humana real pra liberar os recursos de monetização de live, e simular uma live automática é risco real de banimento.",
        ].join("\n"),
      },
    },
    {
      id: "live-comment-roteiro",
      type: "commentNode",
      position: { x: 0, y: -380 },
      style: { width: 1100, height: 400 },
      data: { label: "Comment #2 · Roteiro da live", status: "idle", comment: ROTEIRO_LIVE },
    },
    { id: "live-produto", type: "imageInputNode", position: { x: 0, y: 60 }, style: { width: 200 }, data: { label: "Produto", status: "idle" } },
    {
      id: "live-prompt",
      type: "promptNode",
      position: { x: 320, y: 60 },
      style: { width: 380, height: 420 },
      data: { label: "Text #1", status: "idle", prompt: PROMPT_VITRINE_LIVE },
    },
    {
      id: "live-video-gen",
      type: "videoGeneratorNode",
      position: { x: 780, y: 60 },
      style: { width: 320, height: 220 },
      data: { label: "Vitrine em loop", status: "idle", videoModel: "seedance-2", aspectRatio: "9:16", sound: false },
    },
  ];

  const edges: Edge[] = [
    { id: "live-e-produto", source: "live-produto", target: "live-video-gen", targetHandle: "startFrame", animated: false, style: edgeStyle("startFrame") },
    { id: "live-e-prompt", source: "live-prompt", target: "live-video-gen", targetHandle: "prompt", animated: false, style: edgeStyle("prompt") },
  ];

  return {
    nodes,
    edges,
    nodeCounters: { commentNode: 2, imageInputNode: 1, promptNode: 1, videoGeneratorNode: 1 },
  };
}

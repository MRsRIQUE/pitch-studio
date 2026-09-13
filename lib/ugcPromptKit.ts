/* ============================================================
   O KIT DE PROMPT UGC — o que a receita do @ViralOps_ ensina

   A receita (GPT Images para a pessoa, Seedance 2.5 para o vídeo) não
   tem modelo novo: o que ela tem é um JEITO de escrever o prompt de
   vídeo que os nossos prompts não tinham — ações marcadas por segundo,
   fala com instante, cada referência com o seu papel, e a regra de
   três partes para trocar a pessoa de um vídeo (o que muda, qual
   referência substitui, o que fica igual).

   Este arquivo é a única cópia dessas regras. Quem as usa:
   - `lib/agentePrompt.ts`, para o agente escrever assim no grafo;
   - `lib/cenaProduto.ts`, para a cena de produto já nascer assim;
   - `lib/templates.ts`, no molde "trocar a pessoa do vídeo";
   - `lib/estruturaIdeia.ts`, no briefing UGC da tela Estruturar;
   - `lib/correcaoFocada.ts`, quando só um detalhe saiu errado;
   - `lib/personagensGeracao.ts`, para decompor uma foto de referência.

   Os textos em português são instruções para o modelo de conversa (o
   agente fala português). Os textos em inglês vão direto para os
   modelos de imagem e vídeo, que rendem mais assim.
   ============================================================ */

/* ── Regras, em português, para quem escreve o prompt ─────────── */

export const REGRAS_PROMPT_PRODUCAO_UGC = `Prompt de PRODUÇÃO UGC (Seedance 2.5, Kling 3.0, Veo 3.1 e qualquer modelo que fala), em INGLÊS, 120 a 250 palavras, em blocos nesta ordem:

1. REFERENCES — cada referência com o seu papel, citada pelo rótulo do nó com "@": "@Personagem is the creator: keep her exact face, hair, skin tone and body." / "@Produto is the product: same shape, colours, label and packaging." Só cite referências que estão ligadas ao gerador.
2. SETUP — o primeiro quadro em uma frase: quem, onde, e como a câmera está (front camera at arm's length / phone on a tripod / a friend filming at eye level). Formato 9:16.
3. TIMELINE — ações marcadas por segundo cobrindo a duração INTEIRA, sem buraco: "0-2s: ...", "2-5s: ...", "5-8s: ...". A fala entra entre aspas com o instante: at 3s she says, "..." — em português do Brasil quando o público é brasileiro, curta (5 a 12 palavras por fala), do jeito que uma pessoa fala, sem jargão de anúncio.
4. CAMERA — UM comportamento, nomeado: handheld selfie with subtle natural sway; static phone on a tripod; friend filming handheld at eye level. No zoom, no reframing, no cuts.
5. AUDIO — natural room tone and the creator's voice, no music (a não ser que o pedido diga o contrário).
6. CONSISTENCY — "keep the product in frame and unchanged; keep the creator's identity; natural skin texture; no text overlays, no captions, no logos, no extra hands."`;

export const REGRAS_TROCA_DE_PESSOA = `TROCAR A PESSOA DE UM VÍDEO (Seedance 2.5 Edit, com o vídeo de referência ligado): o prompt tem três partes, nesta ordem — o que MUDA, qual REFERÊNCIA substitui, o que FICA IGUAL. Exemplo:
"Edit the reference video. Replace the person with @Personagem. Place her in the room from @Cenario and make her hold and interact with @Produto. Keep the original actions, timing, camera movement, framing, environment and overall video structure unchanged. at 3s she says, 'guys... i just love these gummies'."
Não descreva a cena inteira de novo: o vídeo de referência já carrega a cena. Descreva só a troca.`;

export const REGRAS_CORRECAO_FOCADA = `CORREÇÃO FOCADA: quando só UM detalhe saiu errado (mão, rótulo, olhar, ritmo, produto trocado), não reescreva o prompt inteiro. Mantenha tudo igual e acrescente no fim um bloco FIX que diz o que preservar e o que corrigir: "FIX: same scene, same creator, same timing and camera as before. The product label must face the camera and stay readable; the right hand holds the bottle by the base with all five fingers visible."`;

/* ── Os prompts em inglês ──────────────────────────────────────── */

/** Uma fala com o instante em que acontece. */
export interface Fala {
  /** Segundo em que a fala começa. */
  em: number;
  texto: string;
}

export interface CenaUGC {
  /**
   * Como a identidade chega ao modelo. "mencoes" (padrão): as fotos estão
   * ligadas como referência e o prompt as cita por "@rótulo", que o gerador
   * resolve para as URLs. "primeiroQuadro": a cena parada é o primeiro
   * quadro e carrega pessoa e produto; o prompt fala dele, sem "@".
   */
  referencia?: "mencoes" | "primeiroQuadro";
  /** Rótulo do nó da pessoa, sem o "@" (ex.: "Personagem"). */
  personagem: string;
  /** Descrição curta da pessoa, para o modelo não depender só da foto. */
  descricaoPessoa?: string;
  /** Rótulo do nó do produto, sem o "@". Vazio quando não há produto. */
  produto?: string;
  /** Nome do produto, para a fala e para o CONSISTENCY. */
  nomeProduto?: string;
  /** Duração total em segundos. Os blocos da timeline cobrem tudo. */
  duracao: number;
  /** Falas, em ordem. Vazio = sem fala (só demonstração). */
  falas?: Fala[];
  /** "selfie" | "tripe" | "amigo" — como a câmera está. */
  camera?: "selfie" | "tripe" | "amigo";
}

const CAMERAS: Record<NonNullable<CenaUGC["camera"]>, string> = {
  selfie: "Handheld selfie on the front camera at arm's length: subtle natural sway from the hand, no zoom, no reframing, no cuts.",
  tripe: "Phone locked on a small tripod at eye level: completely static frame, no zoom, no reframing, no cuts.",
  amigo: "A friend filming handheld at eye level: slight natural micro-movement, no zoom, no reframing, no cuts.",
};

function pronome(descricao?: string): { ela: string; dela: string } {
  const d = (descricao ?? "").toLowerCase();
  if (/\b(homem|man|male|guy|rapaz|garoto|ele)\b/.test(d)) return { ela: "he", dela: "his" };
  return { ela: "she", dela: "her" };
}

/**
 * Monta uma timeline padrão para uma cena de produto: gancho, demonstração,
 * fechamento. As falas entram pelo instante; o que sobra vira ação.
 */
function timelinePadrao(cena: CenaUGC): string[] {
  const { ela, dela } = pronome(cena.descricaoPessoa);
  const D = Math.max(4, Math.round(cena.duracao));
  const produto = cena.nomeProduto ? `the ${cena.nomeProduto}` : cena.produto ? `@${cena.produto}` : "the product";
  const meio = Math.max(2, D - 2);

  const linhas: string[] = [
    `0-2s: ${ela} looks straight into the camera, relaxed, and lifts ${produto} into frame near ${dela} chest.`,
    `2-${meio}s: ${ela} talks to the camera while turning ${produto} slowly to show the front and the label; small natural head and hand movement.`,
    `${meio}-${D}s: ${ela} brings ${produto} closer to the lens for a beat, then smiles and holds the frame.`,
  ];

  const falas = (cena.falas ?? []).filter(f => f.texto.trim());
  for (const f of falas) {
    const em = Math.min(D - 1, Math.max(0, Math.round(f.em)));
    linhas.push(`at ${em}s ${ela} says, "${f.texto.trim().replace(/"/g, "'")}"`);
  }
  return linhas;
}

/**
 * O prompt de produção inteiro, nos seis blocos das regras. É o que a
 * cena de produto e o briefing UGC escrevem no nó de vídeo.
 */
export function promptProducaoUGC(cena: CenaUGC): string {
  const { ela, dela } = pronome(cena.descricaoPessoa);
  const desc = cena.descricaoPessoa ? ` (${cena.descricaoPessoa.trim()})` : "";
  const nomeProd = cena.nomeProduto ? ` (${cena.nomeProduto})` : "";
  const refs: string[] = cena.referencia === "primeiroQuadro"
    ? [
        `The first frame shows the creator${desc}: keep ${dela} exact face, hair, skin tone and body throughout.`,
        ...(cena.produto || cena.nomeProduto
          ? [`The first frame also shows the product${nomeProd}: same shape, colours, label and packaging throughout.`]
          : []),
      ]
    : [
        `@${cena.personagem} is the creator: keep ${dela} exact face, hair, skin tone and body${desc}.`,
        ...(cena.produto ? [`@${cena.produto} is the product${nomeProd}: same shape, colours, label and packaging.`] : []),
      ];
  const camera = CAMERAS[cena.camera ?? "selfie"];
  const objeto = ela === "she" ? "her" : "him";
  const comoFilma =
    cena.camera === "tripe" ? `the phone on a small tripod in front of ${objeto}`
    : cena.camera === "amigo" ? "a friend holding the phone"
    : "holding the phone at arm's length";

  return [
    "REFERENCES",
    ...refs.map(r => `- ${r}`),
    "",
    "SETUP",
    `Vertical 9:16 phone video. ${ela === "she" ? "She" : "He"} is in an everyday room with natural light, framed from the chest up, ${comoFilma}. Candid UGC look, not a studio.`,
    "",
    "TIMELINE",
    ...timelinePadrao(cena),
    "",
    "CAMERA",
    camera,
    "",
    "AUDIO",
    `Natural room tone and ${dela} own voice, no music.`,
    "",
    "CONSISTENCY",
    `Keep the product in frame and unchanged. Keep the creator's identity. Natural skin texture, no beauty filter. No text overlays, no captions, no logos, no extra hands. One continuous shot.`,
  ].join("\n");
}

export interface TrocaDePessoa {
  /** Rótulo do nó da pessoa nova, sem o "@". */
  personagem: string;
  /** Rótulo do nó do cenário novo, sem o "@". Opcional. */
  cenario?: string;
  /** Rótulos dos nós de produto novos, sem "@". Opcional. Um rótulo troca um
   * único objeto; dois rótulos comparam dois produtos lado a lado. */
  produtos?: string[];
  /** Falas para inserir, em ordem, cada uma com o instante. Opcional — vazio
   * = sem fala. Um post de TikTok normalmente usa duas: o gancho nos
   * primeiros segundos e o CTA perto do fim. */
  falas?: Fala[];
}

/**
 * O prompt de três partes para o Seedance 2.5 Edit: o que muda, qual
 * referência substitui, o que fica igual. O vídeo de referência não
 * aparece no texto — ele vai pela entrada `referenceVideo` do nó.
 */
export function promptTrocaDePessoa(t: TrocaDePessoa): string {
  const muda: string[] = [`Replace the person in the reference video with @${t.personagem}: same face, hair, skin tone and body as the reference image.`];
  if (t.cenario) muda.push(`Place the scene inside the room from @${t.cenario}.`);
  const produtos = t.produtos ?? [];
  if (produtos.length === 1) muda.push(`Make the person hold and interact with @${produtos[0]} instead of the original object: same shape, colours, label and packaging.`);
  else if (produtos.length >= 2) muda.push(`Make the person hold @${produtos[0]} in one hand and @${produtos[1]} in the other, comparing them side by side: same shape, colours, label and packaging for each.`);

  const linhas = [
    "Edit the reference video.",
    "",
    "WHAT CHANGES",
    ...muda.map(m => `- ${m}`),
    "",
    "WHAT STAYS THE SAME",
    "- Keep the original actions, timing, camera movement, framing, lighting, environment and overall video structure unchanged.",
    "- Keep natural skin texture. No text overlays, no captions, no logos, no extra hands.",
  ];
  const falas = (t.falas ?? []).filter(f => f.texto.trim()).sort((a, b) => a.em - b.em);
  if (falas.length) {
    linhas.push("", "DIALOGUE", ...falas.map(f => `at ${Math.max(0, Math.round(f.em))}s the person says, "${f.texto.trim().replace(/"/g, "'")}"`));
  }
  return linhas.join("\n");
}

/* ── Decompor uma foto de referência num prompt ─────────────────
   O passo 2 da receita: uma foto casual (Pinterest, feed) vira um prompt
   detalhado de enquadramento, pose, luz e ambiente — e a PESSOA é
   trocada, porque a foto é referência de cena, não de identidade. */

export const PROMPT_DECOMPOR_REFERENCIA = `Look carefully at the attached photo. It is a casual, phone-shot photo that will be used ONLY as a reference for framing, pose, camera angle, outfit style, location and light — NOT for the person's identity.

Write a detailed image-generation prompt in English (120 to 200 words) that recreates this photo with a NEW, original fictional adult person. Cover, in this order:
- PERSON: age range, build, hair (colour, length, texture), skin tone, expression. Invent a distinctive natural person; do not describe the real person's identity.
- OUTFIT: what they wear, in the same style as the photo.
- POSE AND FRAMING: what the person is doing, where they look, how much of the body is in frame, orientation (vertical/horizontal).
- CAMERA: how it was shot (front camera at arm's length, a friend holding the phone, phone on a table), lens feel, depth of field.
- LOCATION AND SURFACES: the room or place, the objects around, materials.
- LIGHT: source, direction, quality (window light from the left, warm lamp, overcast daylight).
- FINISH: candid smartphone photo, natural skin texture, no filter, no text, no watermark.

Answer ONLY with JSON, no prose, no code fence:
{"prompt": "<the English prompt>", "descricao": "<one sentence in Brazilian Portuguese describing the invented person: gender, age range, hair, style>"}`;

/* ── Correção focada ────────────────────────────────────────────── */

export function promptCorrecaoFocada(promptOriginal: string, queixa: string): string {
  return [
    "You are fixing a video-generation prompt after a generation came out with ONE thing wrong.",
    "Do not rewrite the prompt. Keep every line of the original prompt exactly as it is and append a final FIX block that:",
    "1. says explicitly what must stay the same (same scene, same creator, same timing, same camera);",
    "2. states the correction in concrete visual terms (where the hands are, which way the label faces, where the eyes look, what the product looks like);",
    "3. adds a negative instruction for the exact mistake (e.g. 'no second bottle', 'no extra fingers').",
    "Write the FIX block in English, 30 to 80 words. Output ONLY the full prompt (original + FIX block). No explanation, no quotes, no markdown.",
    "",
    "ORIGINAL PROMPT:",
    promptOriginal.trim() || "(empty)",
    "",
    "WHAT CAME OUT WRONG (from the user, may be in Portuguese):",
    queixa.trim(),
  ].join("\n");
}

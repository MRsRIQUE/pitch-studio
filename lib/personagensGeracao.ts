import type { Personagem } from "./personagensStore";
import { productionAI } from "./productionClient";
import { PROMPT_DECOMPOR_REFERENCIA } from "./ugcPromptKit";

/* ── A partir de uma foto de referência ──────────────────────────
   O passo 2 da receita UGC: uma foto casual (Pinterest, um feed) é
   decomposta num prompt de enquadramento, pose, luz e ambiente, e a
   PESSOA é trocada por uma nova — a foto é referência de cena, não de
   identidade. Por isso ela nunca entra em `personagem.fotos`: as fotos
   do personagem são a identidade dele, e esta não é. */

/** Modelo de leitura padrão. O Gemini lê imagem pela Kie sem exigir conta
 *  à parte, que é o que travava o Claude — ver a memória do projeto. */
export const MODELO_LEITURA_PADRAO = "gemini-3.1-pro";

export interface LeituraDeReferencia {
  /** O prompt de geração em inglês, com uma pessoa nova. */
  prompt: string;
  /** Uma frase em português descrevendo a pessoa inventada. */
  descricao: string;
}

/** Aguenta prosa em volta do JSON: fica com o que vai do primeiro "{" ao último "}". */
function lerJson(texto: string): Record<string, unknown> {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new Error("O assistente não devolveu o prompt da foto. Tente outro modelo.");
  try {
    return JSON.parse(limpo.slice(inicio, fim + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("O assistente respondeu num formato inesperado. Tente de novo ou troque o modelo.");
  }
}

export async function decomporReferencia(fotoUrl: string, modelo = MODELO_LEITURA_PADRAO): Promise<LeituraDeReferencia> {
  const texto = await productionAI(PROMPT_DECOMPOR_REFERENCIA, modelo, undefined, [fotoUrl]);
  const dados = lerJson(texto);
  const prompt = typeof dados.prompt === "string" ? dados.prompt.trim() : "";
  if (!prompt) throw new Error("O assistente não devolveu o prompt da foto. Tente outro modelo.");
  const descricao = typeof dados.descricao === "string" ? dados.descricao.trim() : "";
  return { prompt, descricao };
}

/**
 * O prompt do retrato quando ele nasce de uma foto de referência. Depois
 * do primeiro retrato, as fotos do personagem passam a ser a identidade,
 * e o prompt diz isso ao modelo.
 */
export function promptRetratoDeReferencia(prompt: string, temFotos: boolean): string {
  return [
    prompt.trim(),
    "",
    temFotos
      ? "The reference photos show ONE person: this is that same person. Preserve the facial identity, hair, skin tone and proportions exactly; follow the prompt above only for pose, outfit, framing, location and light."
      : "Create one original fictional adult person as described. One person, no collage, no text, no watermark, no beauty filter.",
  ].join("\n");
}

export function promptPersonagem(descricao: string, ambiente: string, temReferencia: boolean): string {
  return [
    `Create one photorealistic UGC creator portrait. Character: ${descricao.trim()}.`,
    temReferencia ? "The reference photos show ONE person. Preserve that person's facial identity, hair, skin tone and proportions." : "Create an original fictional adult person with distinctive, natural features.",
    `Setting and styling: ${ambiente}.`,
    "Vertical medium shot, face clearly visible, looking at the phone camera, relaxed expression, realistic skin texture and natural daylight. Everyday smartphone photography, believable lived-in setting. One person, no collage, no text, no watermark, no beauty filter.",
  ].join("\n");
}

export function promptAvatarCgi(personagem: Personagem, ambiente: string): string {
  const base = personagem.avatarPrompt?.trim();
  if (!base) return promptPersonagem(personagem.descricao, ambiente, personagem.fotos.length > 0);
  return [
    base,
    "",
    "## SCENE",
    `- ${ambiente.trim()}.`,
    personagem.fotos.length > 0
      ? "- Use the reference image as the facial identity source. Preserve the exact person and follow the IDENTITY LOCK above literally; only wardrobe, camera, lighting and setting may change."
      : "- Create one original fictional adult identity and keep every IDENTITY LOCK trait clearly recognizable.",
  ].join("\n");
}

export async function subirReferencia(arquivo: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("Cada referência pode ter até 10 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(arquivo);
  });
  const response = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, folder: "personagens", mimeType: arquivo.type }),
  });
  const data = await response.json();
  if (!response.ok || !data.cdnUrl) throw new Error(data.error || "Não foi possível guardar a referência.");
  return data.cdnUrl;
}

export async function iniciarRetrato(
  personagem: Personagem,
  ambiente: string,
  opcoes: { promptDireto?: string } = {},
): Promise<string> {
  // This entry point creates real characters; do not silently save mock artwork as a face.
  const settings = await fetch("/api/settings/kie-key");
  if (!settings.ok) throw new Error("Não foi possível verificar a conexão. Tente novamente.");
  const connection = await settings.json();
  if (!connection.hasToken) throw new Error("Conecte sua chave Kie.ai nas Configurações para gerar personagens.");
  const response = await fetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nano-banana-pro",
      prompt: opcoes.promptDireto?.trim()
        ? promptRetratoDeReferencia(opcoes.promptDireto, personagem.fotos.length > 0)
        : promptAvatarCgi(personagem, ambiente),
      imageUrls: personagem.fotos,
      aspectRatio: "9:16",
      quality: "1k",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.taskId) throw new Error(data.error || "Não foi possível iniciar a geração.");
  return data.taskId;
}

/* ============================================================
   REMIX — recarrega o composer a partir de uma geração existente

   O botão "Remix" do bloco 05 do Miora devolve o prompt de uma peça para o
   composer. O nosso equivalente já existe: o `handleCopyPrompt` do Acervo, que
   repõe prompt + referências + modelo + proporção.

   Só que ele é um `useCallback` local de `app/gallery/page.tsx` — de outra rota
   não há como chamá-lo. O que dá para usar é o outro lado do mesmo componente:
   o composer hidrata TODO o seu estado inicial de `localStorage`, nos
   inicializadores de `useState` (`loadSettings`, no mesmo arquivo). Como
   `/inspiracao` é outra rota, navegar de lá para `/gallery` desmonta e remonta o
   composer, e esses inicializadores rodam de novo.

   Então o Remix escreve na mesma chave que o composer lê e navega. Nada precisa
   mudar do lado do composer, e o resultado é o mesmo do `handleCopyPrompt` —
   inclusive a ordem em que as referências caem nos slots de vídeo, copiada de
   lá: startFrame → endFrame → videoRef → resource.
   ============================================================ */

import { IMAGE_MODELS, VIDEO_MODELS, type VideoHandle } from "@/lib/modelConfig";
import { useFolderStore } from "@/lib/folderStore";

export type RemixTab = "images" | "videos";

/** Só os campos do `GalleryItem` que o composer sabe receber. */
export interface RemixSource {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  quality?: string;
  azureResolution?: string;
  referenceImageUrls?: string[];
  mediaType: "image" | "video";
}

interface TaggedImage {
  label: string;
  refId: string;
  url: string;
}

/* Espelha `settingsKey` de `app/gallery/page.tsx`. Duplicado de propósito:
   aquele arquivo não é nosso e a função não é exportada. Se o formato da chave
   mudar lá, muda aqui. */
function settingsKey(tab: RemixTab, folderId: string | null): string {
  return folderId ? `nf-gallery-${tab}-folder-${folderId}` : `nf-gallery-${tab}`;
}

/* O prompt guardado já vem com as menções resolvidas (`<<<image 1>>>` ou
   `@image1`). O composer espera a forma curta `@imageN` mais a lista de
   `taggedImages` que liga cada rótulo a uma URL — a mesma des-resolução que o
   `handleCopyPrompt` faz antes de repor o texto. */
function unresolveMentions(text: string, refUrls: string[]): { text: string; tagged: TaggedImage[] } {
  if (refUrls.length === 0) return { text, tagged: [] };
  const tagged: TaggedImage[] = [];
  const processed = text.replace(/<<<image (\d+)>>>|@image(\d+)/gi, (match, g1: string, g2: string) => {
    const n = parseInt(g1 || g2, 10);
    const url = refUrls[n - 1];
    if (!url) return match;
    const label = `image${n}`;
    if (!tagged.some(t => t.label === label)) tagged.push({ label, refId: url, url });
    return `@${label}`;
  });
  return { text: processed, tagged };
}

/**
 * Grava o estado do composer e devolve a rota para onde navegar.
 * Devolve `null` quando não há prompt — sem prompt não há o que remixar, e o
 * botão nem deveria ter sido desenhado.
 */
export function remixToComposer(source: RemixSource): string | null {
  if (typeof window === "undefined") return null;
  const prompt = source.prompt?.trim();
  if (!prompt) return null;

  const tab: RemixTab = source.mediaType === "video" ? "videos" : "images";
  const folderId = useFolderStore.getState().selectedFolderId;
  const key = settingsKey(tab, folderId);

  /* Preserva o resto das preferências do composer (quantidade, duração, modo…):
     o Remix troca a receita, não a configuração da bancada. */
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
  } catch { /* chave corrompida: começa do zero */ }

  const refUrls = source.referenceImageUrls ?? [];
  const { text, tagged } = unresolveMentions(prompt, refUrls);

  const savedModelId = typeof saved.modelId === "string" ? saved.modelId : undefined;
  const models = tab === "videos" ? VIDEO_MODELS : IMAGE_MODELS;
  const model = models.find(m => m.id === source.model);
  const target = model ?? models.find(m => m.id === savedModelId) ?? models[0];

  const next: Record<string, unknown> = { ...saved, prompt: text, taggedImages: tagged };
  if (model) next.modelId = model.id;
  /* A proporção só entra se o modelo de destino a oferecer — o composer
     descartaria uma proporção fora da lista dele de qualquer jeito. */
  if (source.aspectRatio && target.ratios.includes(source.aspectRatio)) {
    next.aspectRatio = source.aspectRatio;
  }

  if (tab === "videos") {
    const vm = VIDEO_MODELS.find(m => m.id === target.id);
    const handles = vm?.handles ?? [];
    const remaining = [...refUrls];
    const takeOne = (handle: VideoHandle) => (handles.includes(handle) && remaining.length > 0 ? remaining.shift()! : null);

    next.vidStartFrameUrl = takeOne("startFrame");
    next.vidEndFrameUrl = takeOne("endFrame");
    next.vidVideoRefUrl = takeOne("videoRef");
    next.vidRefVideoUrls = [];
    next.vidRefAudioUrls = [];
    if (handles.includes("resource") && remaining.length > 0) {
      if (vm?.apiInput.useKlingElements) {
        /* Modelos Kling leem o slot de recurso como "elementos", cada um com
           duas vistas da mesma imagem — igual ao `handleCopyPrompt`. */
        next.vidElements = remaining.map(url => ({ id: url, name: "image", description: "", imageUrls: [url, url] }));
        next.vidResourceUrls = [];
      } else {
        next.vidResourceUrls = remaining;
        next.vidElements = [];
      }
    } else {
      next.vidResourceUrls = [];
      next.vidElements = [];
    }
    next.refImageUrls = [];
  } else {
    next.refImageUrls = refUrls;
    if (source.quality) next.quality = source.quality;
    if (source.azureResolution) next.azureResolution = source.azureResolution;
  }

  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    return null; // sem escrita não há remix; melhor não navegar prometendo o que não vai acontecer
  }

  const folderParam = folderId ? `&folder=${folderId}` : "";
  return `/gallery?tab=${tab}&view=create${folderParam}`;
}

/* ============================================================
   APLICAR ESTILO — o mesmo caminho, com carga diferente

   A tela de Estilos precisa inserir um fragmento no composer. É o mesmo
   problema do Remix e usa a mesma porta: escrever na chave que o composer lê e
   navegar até ele. Nada é importado da frente do composer — o que este arquivo
   conhece é um formato de chave de `localStorage`, não um módulo.

   O `CustomEvent` vai junto para o caso do composer já estar montado quando
   aprender a ouvir; hoje ninguém escuta, e a navegação é que faz o trabalho.
   ============================================================ */

export const ESTILO_APLICADO_EVENT = "pitch:estilo-aplicado";

/**
 * Anexa `fragment` ao prompt guardado do composer e devolve a rota do composer.
 * Devolve `null` se o fragmento for vazio ou se a escrita falhar.
 */
export function applyFragmentToComposer(fragment: string, tab: RemixTab): string | null {
  if (typeof window === "undefined") return null;
  const trimmed = fragment.trim();
  if (!trimmed) return null;

  const folderId = useFolderStore.getState().selectedFolderId;
  const key = settingsKey(tab, folderId);

  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
  } catch { /* chave corrompida: começa do zero */ }

  const current = typeof saved.prompt === "string" ? saved.prompt.trimEnd() : "";
  /* Aplicar duas vezes o mesmo estilo não deve empilhar o texto duas vezes. */
  const next = !current
    ? trimmed
    : current.endsWith(trimmed)
      ? current
      : `${current}\n\n${trimmed}`;

  try {
    localStorage.setItem(key, JSON.stringify({ ...saved, prompt: next }));
  } catch {
    return null;
  }

  window.dispatchEvent(new CustomEvent(ESTILO_APLICADO_EVENT, { detail: { fragment: trimmed, tab } }));

  const folderParam = folderId ? `&folder=${folderId}` : "";
  return `/gallery?tab=${tab}&view=create${folderParam}`;
}

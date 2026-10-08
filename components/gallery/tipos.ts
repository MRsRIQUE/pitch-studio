/**
 * Tipos que a view "Criar" e o Acervo compartilham.
 *
 * Nasceram dentro de `app/gallery/page.tsx`, quando tudo morava num arquivo só.
 * Foram extraídos porque a migração para a linguagem do Miora quebrou aquela
 * tela em componentes que vivem em arquivos diferentes — e três frentes não
 * podem redeclarar a mesma forma cada uma do seu jeito.
 */

/** Aba do Acervo. Decide o modelo padrão, a grade e o que o composer aceita. */
export type Tab = "images" | "videos";

/** Imagem de referência anexada ao prompt, antes ou depois do upload terminar. */
export interface RefImage {
  id: string;
  objectUrl: string;
  cdnUrl: string | null;
  uploading: boolean;
  error: boolean;
}

/**
 * Geração em voo. Ocupa um ladrilho na grade com o tamanho final já reservado,
 * para o layout não pular quando a mídia chega.
 */
export interface PendingGen {
  id: string;
  aspectRatio: string;
  prompt: string;
  modelId?: string;
  quality?: string;
  segmentTaskId?: string;
  maskIndexes?: number[];
  referenceImageUrls?: string[];
  error?: string;
  errorCode?: string;
  taskId?: string;
  createdAt?: string;
  tab?: Tab;
  /** Ainda não subiu para a API: é só o eco otimista do envio. */
  prePending?: boolean;
  retried?: boolean;
  folderId?: string | null;
}

/** Download em preparo, mostrado na torradeira do canto. */
export interface DownloadTask {
  id: string;
  filename: string;
  status: "preparing" | "ready" | "error";
}

/** Mídia citada no prompt por `@`, que vira chip dentro do campo. */
export interface TaggedImage {
  label: string;
  refId: string;
  url: string;
  kind?: "image" | "video" | "audio";
}

/** Elemento reutilizável do Kling, escolhido no seletor de elementos. */
export interface KlingElement {
  id: string;
  name: string;
  description: string;
  imageUrls: string[];
}

/** Item de um menu suspenso do composer (modelo, proporção, qualidade). */
export interface DropOption {
  value: string;
  label: string;
  group?: string;
  preview?: React.ReactNode;
  providerIcon?: React.ReactNode;
}

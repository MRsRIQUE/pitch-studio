/**
 * A camada de dados do Studio, por usuário. Duas implementações com a mesma
 * interface: Firestore do SaySell (produção, `firestore.ts`) e o SQLite local
 * herdado do HeliosGen (desenvolvimento, `sqlite.ts`). Quem escolhe é
 * `index.ts`.
 *
 * Todo método recebe o `uid` explicitamente — não existe mais o usuário
 * implícito `"guest"`.
 */

export interface Generation {
  id: string;
  user_id: string | null;
  task_id: string;
  generation_type: string;
  status: string;
  prompt?: string;
  model?: string;
  aspect_ratio?: string;
  quality?: string;
  azure_resolution?: string;
  duration?: number;
  kling_mode?: string;
  sound?: boolean;
  reference_image_urls?: string[];
  image_url?: string;
  image_urls?: string[];
  video_url?: string;
  error_msg?: string;
  created_at: string;
  updated_at: string;
}

export type NewGeneration = Omit<Generation, "id" | "user_id" | "created_at" | "updated_at">;
export type GenerationUpdate = Partial<
  Pick<Generation, "status" | "image_url" | "image_urls" | "video_url" | "error_msg">
>;

export interface Upload {
  id: string;
  user_id: string;
  r2_url: string;
  mime_type?: string | null;
  source: string;
  created_at: string;
}

export interface ClonedVoice {
  id: string;
  user_id: string;
  voice_id: string;
  name: string;
  source_url?: string | null;
  created_at: string;
}

export interface FolderRecord {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  color?: string | null;
}

export interface FolderItemRecord {
  folder_id: string;
  item_id: string;
  user_id: string;
  created_at: string;
}

export interface GenerationSubmission {
  submission_id: string;
  user_id: string;
  provider: string;
  task_id: string | null;
  state: "submitting" | "accepted" | "uncertain";
}

export interface StudioSpace {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  nodeCounters: Record<string, number>;
  createdAt: number;
  updatedAt?: number;
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * Um job de geração em andamento ou encerrado. Substitui o `jobStore` em
 * disco: é o que o status, o SSE e o Cron leem para avançar o job.
 */
export interface StudioJob {
  taskId: string;
  uid: string;
  kind: "image" | "video";
  provider: "kie" | "mock";
  /** Qual API da kie.ai consultar: a de jobs genérica ou a do Veo. */
  kieApi?: "jobs" | "veo";
  status: "pending" | "done" | "error";
  model: string;
  /** Reserva de crédito no saysell-web; `null` quando o job não cobra. */
  creditJobId: string | null;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  error?: string;
  errorCode?: string;
  createdAt: number;
  updatedAt: number;
  /** Última consulta ao provedor (ms) — evita bater na kie.ai a cada leitura. */
  lastPolledAt?: number;
  /** Provider simulado: quando o resultado fica pronto (ms). */
  mockReadyAt?: number;
  /** Provider simulado: o que desenhar no placeholder. */
  mockInput?: { prompt: string; aspectRatio: string; referenceImageUrls?: string[] };
}

export type JobPatch = Partial<Omit<StudioJob, "taskId" | "uid" | "createdAt">>;

export class SpaceTooLarge extends Error {
  constructor(readonly spaceId: string) {
    super(`O projeto ${spaceId} passou do tamanho máximo que dá para salvar.`);
    this.name = "SpaceTooLarge";
  }
}

export interface StudioData {
  // Gerações
  insertGeneration(uid: string, data: NewGeneration): Promise<void>;
  updateGeneration(uid: string, taskId: string, updates: GenerationUpdate): Promise<void>;
  getGenerationByTask(uid: string, taskId: string): Promise<Generation | null>;
  getGenerations(uid: string, type: "image" | "video"): Promise<Generation[]>;
  deleteGeneration(uid: string, id: string): Promise<void>;

  // Uploads
  insertUpload(uid: string, data: { r2_url: string; mime_type?: string | null; source: string }): Promise<void>;
  getUploads(uid: string, mimeTypePrefix: string): Promise<Upload[]>;
  deleteUpload(uid: string, id: string): Promise<void>;

  // Vozes clonadas
  insertClonedVoice(uid: string, data: { voice_id: string; name: string; source_url?: string | null }): Promise<void>;
  getClonedVoices(uid: string): Promise<ClonedVoice[]>;
  deleteClonedVoice(uid: string, voiceId: string): Promise<void>;

  // Cache de mídia por hash (global: o mesmo arquivo tem a mesma URL)
  lookupAssetHash(hash: string): Promise<string | null>;
  storeAssetHash(hash: string, url: string, mimeType: string, byteSize: number): Promise<void>;

  // Trava de submissão — evita gerar (e cobrar) duas vezes o mesmo clique
  claimGenerationSubmission(
    uid: string,
    submissionId: string,
    provider: string,
  ): Promise<{ claimed: true } | { claimed: false; existing: GenerationSubmission }>;
  acceptGenerationSubmission(uid: string, submissionId: string, taskId: string): Promise<void>;
  markGenerationSubmissionUncertain(uid: string, submissionId: string): Promise<void>;
  releaseGenerationSubmission(uid: string, submissionId: string): Promise<void>;

  // Pastas
  getFolders(uid: string): Promise<FolderRecord[]>;
  insertFolder(uid: string, data: Omit<FolderRecord, "user_id" | "created_at" | "updated_at">): Promise<FolderRecord>;
  updateFolder(
    uid: string,
    id: string,
    updates: Partial<Pick<FolderRecord, "name" | "parent_id" | "order_index" | "color">>,
  ): Promise<void>;
  deleteFolder(uid: string, id: string): Promise<void>;
  getFolderItems(uid: string): Promise<FolderItemRecord[]>;
  insertFolderItems(uid: string, folderId: string, itemIds: string[]): Promise<void>;
  deleteFolderItems(uid: string, folderId: string, itemIds: string[]): Promise<void>;

  // Projetos (workflows)
  getSpaces(uid: string): Promise<StudioSpace[]>;
  /** Grava a lista inteira: cria/atualiza os presentes e apaga os ausentes. */
  saveSpaces(uid: string, spaces: StudioSpace[]): Promise<void>;

  // Links públicos de projeto
  createShare(token: string, uid: string, spaceId: string): Promise<void>;
  getShare(token: string): Promise<{ uid: string; spaceId: string } | null>;
  deleteShare(uid: string, token: string): Promise<void>;

  // Jobs
  getJob(taskId: string): Promise<StudioJob | null>;
  putJob(job: StudioJob): Promise<void>;
  /**
   * Aplica `patch` só se o job ainda estiver em `expectStatus`. Devolve se
   * aplicou — é a trava que impede dois leitores de encerrarem o mesmo job.
   */
  updateJobIf(taskId: string, expectStatus: StudioJob["status"], patch: JobPatch): Promise<boolean>;
  listPendingJobs(limit: number): Promise<StudioJob[]>;
}

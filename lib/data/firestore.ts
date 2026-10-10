/**
 * Camada de dados no Firestore do SaySell (produção).
 *
 *   studio_users/{uid}/generations/{taskId}
 *   studio_users/{uid}/uploads/{id}
 *   studio_users/{uid}/voices/{voiceId}
 *   studio_users/{uid}/submissions/{submissionId}
 *   studio_users/{uid}/folders/{id}
 *   studio_users/{uid}/folder_items/{folderId}__{itemId}
 *   studio_users/{uid}/spaces/{id}
 *   studio_jobs/{taskId}
 *   studio_shares/{token}
 *   studio_asset_cache/{hash}
 *
 * O servidor do Studio escreve com a conta de serviço; nenhuma dessas
 * coleções é lida pelo navegador. Consultas usam um filtro OU uma ordenação
 * (índices de campo único, que o Firestore cria sozinho); o resto é filtrado
 * em memória.
 */
import { randomUUID } from "node:crypto";
import {
  FirestorePreconditionFailed,
  fsCommit,
  fsCreate,
  fsDelete,
  fsGet,
  fsQuery,
  fsSet,
  type FirestoreDoc,
} from "@/lib/firestore/rest";
import {
  SpaceTooLarge,
  type ClonedVoice,
  type FolderItemRecord,
  type FolderRecord,
  type Generation,
  type GenerationSubmission,
  type StudioData,
  type StudioJob,
  type StudioSpace,
  type Upload,
} from "./types";

const LIST_LIMIT = 2000;
/** O documento do Firestore aceita até 1 MiB; a folga cobre os campos ao redor. */
const SPACE_MAX_BYTES = 900_000;

const now = () => new Date().toISOString();
const user = (uid: string) => `studio_users/${uid}`;
/** Id de documento não pode ter "/". */
const safeId = (value: string) => value.replace(/\//g, "_");

const asString = (v: unknown) => (typeof v === "string" ? v : undefined);
const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);

function toGeneration(doc: FirestoreDoc): Generation {
  const d = doc.data;
  return {
    id: asString(d.id) ?? doc.id,
    user_id: asString(d.user_id) ?? null,
    task_id: asString(d.task_id) ?? doc.id,
    generation_type: asString(d.generation_type) ?? "image",
    status: asString(d.status) ?? "pending",
    prompt: asString(d.prompt),
    model: asString(d.model),
    aspect_ratio: asString(d.aspect_ratio),
    quality: asString(d.quality),
    azure_resolution: asString(d.azure_resolution),
    duration: typeof d.duration === "number" ? d.duration : undefined,
    kling_mode: asString(d.kling_mode),
    sound: typeof d.sound === "boolean" ? d.sound : undefined,
    reference_image_urls: asStrings(d.reference_image_urls),
    image_url: asString(d.image_url),
    image_urls: asStrings(d.image_urls),
    video_url: asString(d.video_url),
    error_msg: asString(d.error_msg),
    created_at: asString(d.created_at) ?? "",
    updated_at: asString(d.updated_at) ?? "",
  };
}

function toJob(doc: FirestoreDoc): StudioJob {
  return { ...(doc.data as unknown as StudioJob), taskId: doc.id };
}

export const firestoreData: StudioData = {
  // ── Gerações ──────────────────────────────────────────────────────────────
  async insertGeneration(uid, data) {
    const ts = now();
    // O id da geração é o próprio task id: único, e é o que a galeria apaga.
    await fsCreate(`${user(uid)}/generations/${safeId(data.task_id)}`, {
      ...data,
      id: safeId(data.task_id),
      user_id: uid,
      created_at: ts,
      updated_at: ts,
    });
  },

  async updateGeneration(uid, taskId, updates) {
    await fsSet(`${user(uid)}/generations/${safeId(taskId)}`, { ...updates, updated_at: now() }, true);
  },

  async getGenerationByTask(uid, taskId) {
    const doc = await fsGet(`${user(uid)}/generations/${safeId(taskId)}`);
    return doc ? toGeneration(doc) : null;
  },

  async getGenerations(uid, type) {
    const docs = await fsQuery(user(uid), "generations", {
      orderBy: { field: "created_at", direction: "DESCENDING" },
      limit: LIST_LIMIT,
    });
    return docs
      .map(toGeneration)
      .filter(
        (g) =>
          g.generation_type === type &&
          g.status === "done" &&
          Boolean(type === "video" ? g.video_url : g.image_url),
      );
  },

  async deleteGeneration(uid, id) {
    await fsDelete(`${user(uid)}/generations/${safeId(id)}`);
  },

  // ── Uploads ───────────────────────────────────────────────────────────────
  async insertUpload(uid, data) {
    const id = randomUUID();
    await fsSet(`${user(uid)}/uploads/${id}`, {
      id,
      user_id: uid,
      r2_url: data.r2_url,
      mime_type: data.mime_type ?? null,
      source: data.source,
      created_at: now(),
    });
  },

  async getUploads(uid, mimeTypePrefix) {
    const docs = await fsQuery(user(uid), "uploads", {
      orderBy: { field: "created_at", direction: "DESCENDING" },
      limit: LIST_LIMIT,
    });
    return docs
      .map((doc): Upload => ({
        id: doc.id,
        user_id: uid,
        r2_url: asString(doc.data.r2_url) ?? "",
        mime_type: asString(doc.data.mime_type) ?? null,
        source: asString(doc.data.source) ?? "user_upload",
        created_at: asString(doc.data.created_at) ?? "",
      }))
      .filter((u) => (u.mime_type ?? "").startsWith(mimeTypePrefix));
  },

  async deleteUpload(uid, id) {
    await fsDelete(`${user(uid)}/uploads/${safeId(id)}`);
  },

  // ── Vozes ─────────────────────────────────────────────────────────────────
  async insertClonedVoice(uid, data) {
    await fsCreate(`${user(uid)}/voices/${safeId(data.voice_id)}`, {
      id: randomUUID(),
      user_id: uid,
      voice_id: data.voice_id,
      name: data.name,
      source_url: data.source_url ?? null,
      created_at: now(),
    });
  },

  async getClonedVoices(uid) {
    const docs = await fsQuery(user(uid), "voices", {
      orderBy: { field: "created_at", direction: "DESCENDING" },
      limit: 200,
    });
    return docs.map((doc): ClonedVoice => ({
      id: asString(doc.data.id) ?? doc.id,
      user_id: uid,
      voice_id: asString(doc.data.voice_id) ?? doc.id,
      name: asString(doc.data.name) ?? "",
      source_url: asString(doc.data.source_url) ?? null,
      created_at: asString(doc.data.created_at) ?? "",
    }));
  },

  async deleteClonedVoice(uid, voiceId) {
    await fsDelete(`${user(uid)}/voices/${safeId(voiceId)}`);
  },

  // ── Cache de mídia ────────────────────────────────────────────────────────
  async lookupAssetHash(hash) {
    const doc = await fsGet(`studio_asset_cache/${safeId(hash)}`);
    return asString(doc?.data.cdn_url) ?? null;
  },

  async storeAssetHash(hash, url, mimeType, byteSize) {
    await fsSet(`studio_asset_cache/${safeId(hash)}`, { cdn_url: url, mime_type: mimeType, byte_size: byteSize });
  },

  // ── Submissões ────────────────────────────────────────────────────────────
  async claimGenerationSubmission(uid, submissionId, provider) {
    const path = `${user(uid)}/submissions/${safeId(submissionId)}`;
    const ts = now();
    const created = await fsCreate(path, {
      submission_id: submissionId,
      user_id: uid,
      provider,
      task_id: null,
      state: "submitting",
      created_at: ts,
      updated_at: ts,
    });
    if (created) return { claimed: true };
    const doc = await fsGet(path);
    const d = doc?.data ?? {};
    const existing: GenerationSubmission = {
      submission_id: submissionId,
      user_id: uid,
      provider: asString(d.provider) ?? provider,
      task_id: asString(d.task_id) ?? null,
      state: (asString(d.state) as GenerationSubmission["state"]) ?? "submitting",
    };
    return { claimed: false, existing };
  },

  async acceptGenerationSubmission(uid, submissionId, taskId) {
    await fsSet(
      `${user(uid)}/submissions/${safeId(submissionId)}`,
      { task_id: taskId, state: "accepted", updated_at: now() },
      true,
    );
  },

  async markGenerationSubmissionUncertain(uid, submissionId) {
    await fsSet(`${user(uid)}/submissions/${safeId(submissionId)}`, { state: "uncertain", updated_at: now() }, true);
  },

  async releaseGenerationSubmission(uid, submissionId) {
    const path = `${user(uid)}/submissions/${safeId(submissionId)}`;
    const doc = await fsGet(path);
    if (!doc || doc.data.task_id || doc.data.state !== "submitting") return;
    try {
      await fsCommit([{ kind: "delete", path }]);
    } catch (error) {
      if (!(error instanceof FirestorePreconditionFailed)) throw error;
    }
  },

  // ── Pastas ────────────────────────────────────────────────────────────────
  async getFolders(uid) {
    const docs = await fsQuery(user(uid), "folders", { orderBy: { field: "order_index", direction: "ASCENDING" } });
    return docs.map((doc): FolderRecord => ({
      id: doc.id,
      user_id: uid,
      name: asString(doc.data.name) ?? "",
      parent_id: asString(doc.data.parent_id) ?? null,
      order_index: typeof doc.data.order_index === "number" ? doc.data.order_index : 0,
      created_at: asString(doc.data.created_at) ?? "",
      updated_at: asString(doc.data.updated_at) ?? "",
      color: asString(doc.data.color) ?? null,
    }));
  },

  async insertFolder(uid, data) {
    const ts = now();
    const record: FolderRecord = {
      ...data,
      user_id: uid,
      parent_id: data.parent_id ?? null,
      order_index: data.order_index ?? 0,
      created_at: ts,
      updated_at: ts,
    };
    await fsSet(`${user(uid)}/folders/${safeId(data.id)}`, { ...record });
    return record;
  },

  async updateFolder(uid, id, updates) {
    await fsSet(`${user(uid)}/folders/${safeId(id)}`, { ...updates, updated_at: now() }, true);
  },

  async deleteFolder(uid, id) {
    const items = await fsQuery(user(uid), "folder_items", { where: { field: "folder_id", op: "EQUAL", value: id } });
    await fsCommit([
      { kind: "delete", path: `${user(uid)}/folders/${safeId(id)}` },
      ...items.map((doc) => ({ kind: "delete" as const, path: doc.path })),
    ]);
  },

  async getFolderItems(uid) {
    const docs = await fsQuery(user(uid), "folder_items", { limit: 10_000 });
    return docs.map((doc): FolderItemRecord => ({
      folder_id: asString(doc.data.folder_id) ?? "",
      item_id: asString(doc.data.item_id) ?? "",
      user_id: uid,
      created_at: asString(doc.data.created_at) ?? "",
    }));
  },

  async insertFolderItems(uid, folderId, itemIds) {
    const ts = now();
    await fsCommit(
      itemIds.map((itemId) => ({
        kind: "set" as const,
        path: `${user(uid)}/folder_items/${safeId(`${folderId}__${itemId}`)}`,
        data: { folder_id: folderId, item_id: itemId, user_id: uid, created_at: ts },
      })),
    );
  },

  async deleteFolderItems(uid, folderId, itemIds) {
    await fsCommit(
      itemIds.map((itemId) => ({
        kind: "delete" as const,
        path: `${user(uid)}/folder_items/${safeId(`${folderId}__${itemId}`)}`,
      })),
    );
  },

  // ── Projetos ──────────────────────────────────────────────────────────────
  async getSpaces(uid) {
    const docs = await fsQuery(user(uid), "spaces", { orderBy: { field: "updated_at", direction: "ASCENDING" } });
    return docs.flatMap((doc) => {
      try {
        return [JSON.parse(asString(doc.data.data) ?? "") as StudioSpace];
      } catch {
        return [];
      }
    });
  },

  async saveSpaces(uid, spaces) {
    const stored = await fsQuery(user(uid), "spaces", { select: ["updated_at"] });
    const storedAt = new Map(stored.map((doc) => [doc.id, doc.data.updated_at]));
    const keep = new Set(spaces.map((s) => safeId(s.id)));
    const writes: Parameters<typeof fsCommit>[0] = [];
    for (const space of spaces) {
      const updatedAt = Number(space.updatedAt ?? space.createdAt ?? Date.now());
      const id = safeId(space.id);
      // Projeto que não mudou desde a última gravação não é regravado.
      if (storedAt.get(id) === updatedAt) continue;
      const data = JSON.stringify(space);
      if (Buffer.byteLength(data, "utf8") > SPACE_MAX_BYTES) throw new SpaceTooLarge(space.id);
      writes.push({
        kind: "set",
        path: `${user(uid)}/spaces/${id}`,
        data: { name: space.name ?? "Sem título", data, updated_at: updatedAt },
      });
    }
    for (const id of storedAt.keys()) {
      if (!keep.has(id)) writes.push({ kind: "delete", path: `${user(uid)}/spaces/${id}` });
    }
    await fsCommit(writes);
  },

  // ── Links públicos ────────────────────────────────────────────────────────
  async createShare(token, uid, spaceId) {
    await fsSet(`studio_shares/${safeId(token)}`, { uid, spaceId, created_at: now() });
  },

  async getShare(token) {
    const doc = await fsGet(`studio_shares/${safeId(token)}`);
    const uid = asString(doc?.data.uid);
    const spaceId = asString(doc?.data.spaceId);
    return uid && spaceId ? { uid, spaceId } : null;
  },

  async deleteShare(uid, token) {
    const doc = await fsGet(`studio_shares/${safeId(token)}`);
    if (doc?.data.uid === uid) await fsDelete(doc.path);
  },

  // ── Jobs ──────────────────────────────────────────────────────────────────
  async getJob(taskId) {
    const doc = await fsGet(`studio_jobs/${safeId(taskId)}`);
    return doc ? toJob(doc) : null;
  },

  async putJob(job) {
    await fsSet(`studio_jobs/${safeId(job.taskId)}`, { ...job });
  },

  async updateJobIf(taskId, expectStatus, patch) {
    const doc = await fsGet(`studio_jobs/${safeId(taskId)}`);
    if (!doc || doc.data.status !== expectStatus) return false;
    try {
      await fsCommit([
        {
          kind: "set",
          path: doc.path,
          data: { ...patch, updatedAt: Date.now() },
          merge: true,
          precondition: { updateTime: doc.updateTime },
        },
      ]);
      return true;
    } catch (error) {
      if (error instanceof FirestorePreconditionFailed) return false;
      throw error;
    }
  },

  async listPendingJobs(limit) {
    const docs = await fsQuery("", "studio_jobs", { where: { field: "status", op: "EQUAL", value: "pending" }, limit });
    return docs.map(toJob);
  },
};

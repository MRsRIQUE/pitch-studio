/**
 * Camada de dados em SQLite (`node:sqlite`) — só para desenvolvimento local,
 * sem credencial do Firestore. É o banco herdado do HeliosGen
 * (`lib/guest/sqlite.ts`), agora com o `uid` em todo lugar e as tabelas de job
 * e de link público.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/guest/sqlite";
import {
  SpaceTooLarge,
  type FolderRecord,
  type Generation,
  type GenerationSubmission,
  type StudioData,
  type StudioJob,
  type StudioSpace,
} from "./types";

const SPACE_MAX_BYTES = 900_000;
const now = () => new Date().toISOString();

let ready = false;
function sql() {
  const d = db();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS studio_jobs (
        task_id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_studio_jobs_status ON studio_jobs (status);
      CREATE TABLE IF NOT EXISTS studio_shares (
        token TEXT PRIMARY KEY, uid TEXT NOT NULL, space_id TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
    const cols = d.prepare("PRAGMA table_info(spaces)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "user_id")) d.exec("ALTER TABLE spaces ADD COLUMN user_id TEXT");
    ready = true;
  }
  return d;
}

type Row = Record<string, unknown>;
const parseArr = (v: unknown): string[] | undefined =>
  typeof v === "string" && v ? (JSON.parse(v) as string[]) : undefined;

function rowToGeneration(r: Row): Generation {
  return {
    id: r.id as string,
    user_id: (r.user_id as string) ?? null,
    task_id: r.task_id as string,
    generation_type: r.generation_type as string,
    status: r.status as string,
    prompt: (r.prompt as string) ?? undefined,
    model: (r.model as string) ?? undefined,
    aspect_ratio: (r.aspect_ratio as string) ?? undefined,
    quality: (r.quality as string) ?? undefined,
    azure_resolution: (r.azure_resolution as string) ?? undefined,
    duration: (r.duration as number) ?? undefined,
    kling_mode: (r.kling_mode as string) ?? undefined,
    sound: r.sound == null ? undefined : Boolean(r.sound),
    reference_image_urls: parseArr(r.reference_image_urls),
    image_url: (r.image_url as string) ?? undefined,
    image_urls: parseArr(r.image_urls),
    video_url: (r.video_url as string) ?? undefined,
    error_msg: (r.error_msg as string) ?? undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToFolder(r: Row): FolderRecord {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    name: r.name as string,
    parent_id: (r.parent_id as string) ?? null,
    order_index: (r.order_index as number) ?? 0,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    color: (r.color as string) ?? null,
  };
}

export const sqliteData: StudioData = {
  async insertGeneration(uid, data) {
    const ts = now();
    sql()
      .prepare(`
        INSERT INTO generations
          (id, user_id, task_id, generation_type, status, prompt, model, aspect_ratio,
           quality, azure_resolution, duration, kling_mode, sound, reference_image_urls,
           image_url, image_urls, video_url, error_msg, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO NOTHING
      `)
      .run(
        randomUUID(), uid, data.task_id, data.generation_type, data.status,
        data.prompt ?? null, data.model ?? null, data.aspect_ratio ?? null, data.quality ?? null,
        data.azure_resolution ?? null, data.duration ?? null, data.kling_mode ?? null,
        data.sound ? 1 : 0,
        data.reference_image_urls ? JSON.stringify(data.reference_image_urls) : null,
        data.image_url ?? null, data.image_urls ? JSON.stringify(data.image_urls) : null,
        data.video_url ?? null, data.error_msg ?? null, ts, ts,
      );
  },

  async updateGeneration(uid, taskId, updates) {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [now()];
    if ("status" in updates) { sets.push("status = ?"); vals.push(updates.status ?? null); }
    if ("image_url" in updates) { sets.push("image_url = ?"); vals.push(updates.image_url ?? null); }
    if ("image_urls" in updates) { sets.push("image_urls = ?"); vals.push(updates.image_urls ? JSON.stringify(updates.image_urls) : null); }
    if ("video_url" in updates) { sets.push("video_url = ?"); vals.push(updates.video_url ?? null); }
    if ("error_msg" in updates) { sets.push("error_msg = ?"); vals.push(updates.error_msg ?? null); }
    vals.push(taskId, uid);
    sql().prepare(`UPDATE generations SET ${sets.join(", ")} WHERE task_id = ? AND user_id = ?`).run(...(vals as never[]));
  },

  async getGenerationByTask(uid, taskId) {
    const r = sql().prepare("SELECT * FROM generations WHERE task_id = ? AND user_id = ?").get(taskId, uid) as Row | undefined;
    return r ? rowToGeneration(r) : null;
  },

  async getGenerations(uid, type) {
    const urlCol = type === "video" ? "video_url" : "image_url";
    const rows = sql()
      .prepare(`
        SELECT * FROM generations
        WHERE user_id = ? AND generation_type = ? AND status = 'done'
          AND ${urlCol} IS NOT NULL AND ${urlCol} != ''
        ORDER BY created_at DESC LIMIT 2000
      `)
      .all(uid, type) as Row[];
    return rows.map(rowToGeneration);
  },

  async deleteGeneration(uid, id) {
    sql().prepare("DELETE FROM generations WHERE id = ? AND user_id = ?").run(id, uid);
  },

  async insertUpload(uid, data) {
    sql()
      .prepare("INSERT INTO uploads (id, user_id, r2_url, mime_type, source, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), uid, data.r2_url, data.mime_type ?? null, data.source, now());
  },

  async getUploads(uid, mimeTypePrefix) {
    const rows = sql()
      .prepare(`
        SELECT * FROM uploads WHERE user_id = ? AND COALESCE(mime_type, '') LIKE ? || '%'
        ORDER BY created_at DESC LIMIT 2000
      `)
      .all(uid, mimeTypePrefix) as Row[];
    return rows.map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      r2_url: r.r2_url as string,
      mime_type: (r.mime_type as string) ?? null,
      source: r.source as string,
      created_at: r.created_at as string,
    }));
  },

  async deleteUpload(uid, id) {
    sql().prepare("DELETE FROM uploads WHERE id = ? AND user_id = ?").run(id, uid);
  },

  async insertClonedVoice(uid, data) {
    sql()
      .prepare("INSERT INTO cloned_voices (id, user_id, voice_id, name, source_url, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(voice_id) DO NOTHING")
      .run(randomUUID(), uid, data.voice_id, data.name, data.source_url ?? null, now());
  },

  async getClonedVoices(uid) {
    const rows = sql()
      .prepare("SELECT * FROM cloned_voices WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
      .all(uid) as Row[];
    return rows.map((r) => ({
      id: r.id as string,
      user_id: r.user_id as string,
      voice_id: r.voice_id as string,
      name: r.name as string,
      source_url: (r.source_url as string) ?? null,
      created_at: r.created_at as string,
    }));
  },

  async deleteClonedVoice(uid, voiceId) {
    sql().prepare("DELETE FROM cloned_voices WHERE voice_id = ? AND user_id = ?").run(voiceId, uid);
  },

  async lookupAssetHash(hash) {
    const r = sql().prepare("SELECT cdn_url FROM asset_cache WHERE hash = ?").get(hash) as { cdn_url: string } | undefined;
    return r?.cdn_url ?? null;
  },

  async storeAssetHash(hash, url, mimeType, byteSize) {
    sql()
      .prepare(`
        INSERT INTO asset_cache (hash, cdn_url, mime_type, byte_size) VALUES (?, ?, ?, ?)
        ON CONFLICT(hash) DO UPDATE SET cdn_url = excluded.cdn_url,
          mime_type = excluded.mime_type, byte_size = excluded.byte_size
      `)
      .run(hash, url, mimeType, byteSize);
  },

  async claimGenerationSubmission(uid, submissionId, provider) {
    const ts = now();
    const result = sql()
      .prepare(`
        INSERT INTO generation_submissions
          (submission_id, user_id, provider, task_id, state, created_at, updated_at)
        VALUES (?, ?, ?, NULL, 'submitting', ?, ?)
        ON CONFLICT(submission_id) DO NOTHING
      `)
      .run(submissionId, uid, provider, ts, ts);
    if (Number(result.changes) > 0) return { claimed: true };
    const existing = sql()
      .prepare("SELECT submission_id, user_id, provider, task_id, state FROM generation_submissions WHERE submission_id = ?")
      .get(submissionId) as unknown as GenerationSubmission;
    return { claimed: false, existing };
  },

  async acceptGenerationSubmission(uid, submissionId, taskId) {
    sql()
      .prepare("UPDATE generation_submissions SET task_id = ?, state = 'accepted', updated_at = ? WHERE submission_id = ? AND user_id = ?")
      .run(taskId, now(), submissionId, uid);
  },

  async markGenerationSubmissionUncertain(uid, submissionId) {
    sql()
      .prepare("UPDATE generation_submissions SET state = 'uncertain', updated_at = ? WHERE submission_id = ? AND user_id = ?")
      .run(now(), submissionId, uid);
  },

  async releaseGenerationSubmission(uid, submissionId) {
    sql()
      .prepare("DELETE FROM generation_submissions WHERE submission_id = ? AND user_id = ? AND task_id IS NULL AND state = 'submitting'")
      .run(submissionId, uid);
  },

  async getFolders(uid) {
    const rows = sql().prepare("SELECT * FROM folders WHERE user_id = ? ORDER BY order_index").all(uid) as Row[];
    return rows.map(rowToFolder);
  },

  async insertFolder(uid, data) {
    const ts = now();
    sql()
      .prepare("INSERT INTO folders (id, user_id, name, parent_id, order_index, created_at, updated_at, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(data.id, uid, data.name, data.parent_id ?? null, data.order_index ?? 0, ts, ts, data.color ?? null);
    return { ...data, user_id: uid, parent_id: data.parent_id ?? null, created_at: ts, updated_at: ts };
  },

  async updateFolder(uid, id, updates) {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [now()];
    if ("name" in updates) { sets.push("name = ?"); vals.push(updates.name); }
    if ("parent_id" in updates) { sets.push("parent_id = ?"); vals.push(updates.parent_id ?? null); }
    if ("order_index" in updates) { sets.push("order_index = ?"); vals.push(updates.order_index); }
    if ("color" in updates) { sets.push("color = ?"); vals.push(updates.color ?? null); }
    vals.push(id, uid);
    sql().prepare(`UPDATE folders SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...(vals as never[]));
  },

  async deleteFolder(uid, id) {
    const d = sql();
    d.exec("BEGIN");
    d.prepare("DELETE FROM folders WHERE id = ? AND user_id = ?").run(id, uid);
    d.prepare("DELETE FROM folder_items WHERE folder_id = ? AND user_id = ?").run(id, uid);
    d.exec("COMMIT");
  },

  async getFolderItems(uid) {
    const rows = sql().prepare("SELECT * FROM folder_items WHERE user_id = ?").all(uid) as Row[];
    return rows.map((r) => ({
      folder_id: r.folder_id as string,
      item_id: r.item_id as string,
      user_id: r.user_id as string,
      created_at: r.created_at as string,
    }));
  },

  async insertFolderItems(uid, folderId, itemIds) {
    const stmt = sql().prepare(
      "INSERT INTO folder_items (folder_id, item_id, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(folder_id, item_id) DO NOTHING",
    );
    const ts = now();
    for (const itemId of itemIds) stmt.run(folderId, itemId, uid, ts);
  },

  async deleteFolderItems(uid, folderId, itemIds) {
    if (itemIds.length === 0) return;
    const placeholders = itemIds.map(() => "?").join(", ");
    sql()
      .prepare(`DELETE FROM folder_items WHERE folder_id = ? AND user_id = ? AND item_id IN (${placeholders})`)
      .run(folderId, uid, ...itemIds);
  },

  async getSpaces(uid) {
    const rows = sql().prepare("SELECT data FROM spaces WHERE user_id = ? ORDER BY updated_at ASC").all(uid) as Array<{ data: string }>;
    return rows.flatMap((r) => {
      try {
        return [JSON.parse(r.data) as StudioSpace];
      } catch {
        return [];
      }
    });
  },

  async saveSpaces(uid, spaces) {
    for (const s of spaces) {
      if (Buffer.byteLength(JSON.stringify(s), "utf8") > SPACE_MAX_BYTES) throw new SpaceTooLarge(s.id);
    }
    const d = sql();
    d.exec("BEGIN");
    const keep = new Set(spaces.map((s) => s.id));
    const upsert = d.prepare(`
      INSERT INTO spaces (id, name, data, updated_at, user_id) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
      WHERE spaces.user_id = excluded.user_id
    `);
    for (const s of spaces) {
      upsert.run(s.id, s.name ?? "Sem título", JSON.stringify(s), Number(s.updatedAt ?? s.createdAt ?? Date.now()), uid);
    }
    const existing = d.prepare("SELECT id FROM spaces WHERE user_id = ?").all(uid) as Array<{ id: string }>;
    const del = d.prepare("DELETE FROM spaces WHERE id = ? AND user_id = ?");
    for (const { id } of existing) if (!keep.has(id)) del.run(id, uid);
    d.exec("COMMIT");
  },

  async createShare(token, uid, spaceId) {
    sql().prepare("INSERT OR REPLACE INTO studio_shares (token, uid, space_id, created_at) VALUES (?, ?, ?, ?)").run(token, uid, spaceId, now());
  },

  async getShare(token) {
    const r = sql().prepare("SELECT uid, space_id FROM studio_shares WHERE token = ?").get(token) as
      | { uid: string; space_id: string }
      | undefined;
    return r ? { uid: r.uid, spaceId: r.space_id } : null;
  },

  async deleteShare(uid, token) {
    sql().prepare("DELETE FROM studio_shares WHERE token = ? AND uid = ?").run(token, uid);
  },

  async getJob(taskId) {
    const r = sql().prepare("SELECT data FROM studio_jobs WHERE task_id = ?").get(taskId) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as StudioJob) : null;
  },

  async putJob(job) {
    sql()
      .prepare("INSERT OR REPLACE INTO studio_jobs (task_id, status, data, updated_at) VALUES (?, ?, ?, ?)")
      .run(job.taskId, job.status, JSON.stringify(job), job.updatedAt);
  },

  async updateJobIf(taskId, expectStatus, patch) {
    const d = sql();
    d.exec("BEGIN IMMEDIATE");
    try {
      const r = d.prepare("SELECT data FROM studio_jobs WHERE task_id = ? AND status = ?").get(taskId, expectStatus) as
        | { data: string }
        | undefined;
      if (!r) {
        d.exec("COMMIT");
        return false;
      }
      const next: StudioJob = { ...(JSON.parse(r.data) as StudioJob), ...patch, updatedAt: Date.now() };
      d.prepare("UPDATE studio_jobs SET status = ?, data = ?, updated_at = ? WHERE task_id = ?").run(
        next.status, JSON.stringify(next), next.updatedAt, taskId,
      );
      d.exec("COMMIT");
      return true;
    } catch (error) {
      d.exec("ROLLBACK");
      throw error;
    }
  },

  async listPendingJobs(limit) {
    const rows = sql().prepare("SELECT data FROM studio_jobs WHERE status = 'pending' LIMIT ?").all(limit) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as StudioJob);
  },
};

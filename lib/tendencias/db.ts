/* ============================================================
   MOTOR DE TENDÊNCIAS — a tabela `trends` no SQLite local

   Mesmo banco de `lib/guest/sqlite.ts`, mas o esquema desta frente vive
   aqui e é criado sob demanda (`CREATE TABLE IF NOT EXISTS` na primeira
   chamada). Motivo: `sqlite.ts` e `lib/guest/db.ts` são base comum do app,
   e manter o esquema das tendências neste arquivo deixa a frente
   destacável sem encostar neles.

   As outras três tabelas decididas (`trend_insights`, `brands`,
   `trend_brand_fit`) entram junto com os passos que as usam (4.3 e 4.4).
   ============================================================ */

import { randomUUID } from "node:crypto";
import { db } from "@/lib/guest/sqlite";
import type { MetricasTendencia, OrigemTendencia, StatusTendencia, Tendencia } from "./tipos";

let esquemaPronto = false;

function banco() {
  const d = db();
  if (!esquemaPronto) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS trends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_key TEXT,
        source_url TEXT,
        source_handle TEXT,
        caption TEXT,
        duration REAL,
        metrics TEXT,
        video_url TEXT NOT NULL,
        status TEXT NOT NULL,
        error_msg TEXT,
        rights_confirmed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trends_user ON trends (user_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_trends_source_key
        ON trends (user_id, source_key) WHERE source_key IS NOT NULL;
    `);
    esquemaPronto = true;
  }
  return d;
}

type Linha = Record<string, unknown>;

function metricas(texto: unknown): MetricasTendencia {
  if (typeof texto !== "string") return {};
  try {
    return JSON.parse(texto) as MetricasTendencia;
  } catch {
    return {};
  }
}

function paraTendencia(r: Linha): Tendencia {
  return {
    id: r.id as string,
    origem: r.source as OrigemTendencia,
    linkOrigem: (r.source_url as string | null) ?? null,
    handle: (r.source_handle as string | null) ?? null,
    legenda: (r.caption as string | null) ?? null,
    duracao: typeof r.duration === "number" ? r.duration : null,
    metricas: metricas(r.metrics),
    videoUrl: r.video_url as string,
    status: r.status as StatusTendencia,
    erro: (r.error_msg as string | null) ?? null,
    direitoConfirmadoEm: r.rights_confirmed_at as string,
    criadaEm: r.created_at as string,
  };
}

export interface NovaTendencia {
  origem: OrigemTendencia;
  /** Identidade do post na fonte (`tiktok:7301…`) ou do arquivo (`upload:/generated/…`). */
  chaveOrigem: string;
  linkOrigem: string | null;
  handle: string | null;
  legenda: string | null;
  duracao: number | null;
  metricas: MetricasTendencia;
  videoUrl: string;
}

export function inserirTendencia(userId: string, t: NovaTendencia): Tendencia {
  const id = randomUUID();
  const agora = new Date().toISOString();
  banco()
    .prepare(
      `INSERT INTO trends (id, user_id, source, source_key, source_url, source_handle, caption,
         duration, metrics, video_url, status, error_msg, rights_confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importada', NULL, ?, ?, ?)`,
    )
    .run(id, userId, t.origem, t.chaveOrigem, t.linkOrigem, t.handle, t.legenda, t.duracao,
      JSON.stringify(t.metricas), t.videoUrl, agora, agora, agora);
  return obterTendencia(userId, id)!;
}

export function obterTendencia(userId: string, id: string): Tendencia | null {
  const r = banco().prepare("SELECT * FROM trends WHERE id = ? AND user_id = ?").get(id, userId) as Linha | undefined;
  return r ? paraTendencia(r) : null;
}

export function tendenciaPorChave(userId: string, chaveOrigem: string): Tendencia | null {
  const r = banco()
    .prepare("SELECT * FROM trends WHERE user_id = ? AND source_key = ?")
    .get(userId, chaveOrigem) as Linha | undefined;
  return r ? paraTendencia(r) : null;
}

export function listarTendencias(userId: string): Tendencia[] {
  const rows = banco()
    .prepare("SELECT * FROM trends WHERE user_id = ? ORDER BY created_at DESC LIMIT 500")
    .all(userId) as Linha[];
  return rows.map(paraTendencia);
}

/** Só a linha sai: o vídeo fica no acervo, porque o dedupe por hash pode tê-lo compartilhado. */
export function removerTendencia(userId: string, id: string): boolean {
  const r = banco().prepare("DELETE FROM trends WHERE id = ? AND user_id = ?").run(id, userId);
  return Number(r.changes) > 0;
}

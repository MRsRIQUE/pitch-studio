import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const databasePath = process.env.PITCH_STUDIO_DB_PATH ?? resolve(process.cwd(), 'data', 'pitch-studio.db')
mkdirSync(dirname(databasePath), { recursive: true })

export const database = new DatabaseSync(databasePath)
database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

database.exec(`
  CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('queued','processing','succeeded','failed')),
    provider TEXT NOT NULL,
    input_json TEXT NOT NULL,
    result_json TEXT,
    error TEXT,
    cost_credits INTEGER NOT NULL CHECK(cost_credits >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_jobs (
    generation_id TEXT PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL,
    locked_at TEXT,
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL UNIQUE REFERENCES generation_jobs(id),
    kind TEXT NOT NULL CHECK(kind IN ('image','video')),
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_accounts (
    id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL CHECK(balance >= 0),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES credit_accounts(id),
    generation_id TEXT REFERENCES generation_jobs(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_generation_status ON generation_jobs(status, updated_at);
  CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_credit_ledger_account ON credit_ledger(account_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_generation_reason ON credit_ledger(generation_id, reason);
`)

function ensureColumn(table: string, column: string, definition: string) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((candidate) => candidate.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

ensureColumn('generation_jobs', 'workspace_id', "TEXT NOT NULL DEFAULT 'demo-workspace'")
ensureColumn('generation_jobs', 'project_id', "TEXT NOT NULL DEFAULT 'legacy-project'")
ensureColumn('assets', 'workspace_id', "TEXT NOT NULL DEFAULT 'demo-workspace'")
ensureColumn('assets', 'project_id', "TEXT NOT NULL DEFAULT 'legacy-project'")

const now = new Date().toISOString()
database.prepare('INSERT OR IGNORE INTO credit_accounts (id, balance, updated_at) VALUES (?, ?, ?)').run('demo-workspace', 1000, now)

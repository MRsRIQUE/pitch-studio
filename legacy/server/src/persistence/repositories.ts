import type { AssetRecord, GenerationInput, GenerationJob, GenerationResult } from '../domain.js'
import { database } from './database.js'

type JobRow = { id: string; status: GenerationJob['status']; provider: string; input_json: string; result_json: string | null; error: string | null; cost_credits: number; created_at: string; updated_at: string }

function toJob(row: JobRow): GenerationJob {
  return { id: row.id, status: row.status, provider: row.provider, input: JSON.parse(row.input_json) as GenerationInput, result: row.result_json ? JSON.parse(row.result_json) as GenerationResult : undefined, error: row.error ?? undefined, costCredits: row.cost_credits, createdAt: row.created_at, updatedAt: row.updated_at }
}

export class GenerationRepository {
  insert(job: GenerationJob) {
    database.prepare('INSERT INTO generation_jobs (id,status,provider,input_json,result_json,error,cost_credits,created_at,updated_at,workspace_id,project_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(job.id, job.status, job.provider, JSON.stringify(job.input), null, null, job.costCredits, job.createdAt, job.updatedAt, job.input.workspaceId, job.input.projectId)
  }

  get(id: string) {
    const row = database.prepare('SELECT * FROM generation_jobs WHERE id = ?').get(id) as JobRow | undefined
    return row ? toJob(row) : undefined
  }

  update(id: string, patch: Partial<Pick<GenerationJob, 'status' | 'result' | 'error'>>) {
    const current = this.get(id)
    if (!current) return
    database.prepare('UPDATE generation_jobs SET status=?, result_json=?, error=?, updated_at=? WHERE id=?').run(patch.status ?? current.status, patch.result ? JSON.stringify(patch.result) : current.result ? JSON.stringify(current.result) : null, patch.error ?? current.error ?? null, new Date().toISOString(), id)
  }

  recoverable() {
    return (database.prepare("SELECT * FROM generation_jobs WHERE status IN ('queued','processing') ORDER BY created_at").all() as JobRow[]).map(toJob)
  }
}

export class QueueRepository {
  enqueue(generationId: string) {
    database.prepare("INSERT OR REPLACE INTO queue_jobs (generation_id,status,attempts,available_at,locked_at,last_error) VALUES (?,'pending',0,?,NULL,NULL)").run(generationId, new Date().toISOString())
  }
  markRunning(generationId: string) { database.prepare("UPDATE queue_jobs SET status='running', attempts=attempts+1, locked_at=? WHERE generation_id=?").run(new Date().toISOString(), generationId) }
  markCompleted(generationId: string) { database.prepare("UPDATE queue_jobs SET status='completed', locked_at=NULL WHERE generation_id=?").run(generationId) }
  markFailed(generationId: string, error: string) { database.prepare("UPDATE queue_jobs SET status='failed', locked_at=NULL, last_error=? WHERE generation_id=?").run(error, generationId) }
  recover() { database.prepare("UPDATE queue_jobs SET status='pending', locked_at=NULL WHERE status='running'").run() }
}

export class CreditRepository {
  balance(accountId = 'demo-workspace') {
    const row = database.prepare('SELECT balance FROM credit_accounts WHERE id=?').get(accountId) as { balance: number } | undefined
    return row?.balance ?? 0
  }

  debit(generationId: string, amount: number, accountId = 'demo-workspace') {
    database.exec('BEGIN IMMEDIATE')
    try {
      const now = new Date().toISOString()
      const updated = database.prepare('UPDATE credit_accounts SET balance=balance-?, updated_at=? WHERE id=? AND balance>=?').run(amount, now, accountId, amount)
      if (updated.changes === 0) throw new Error('INSUFFICIENT_CREDITS')
      database.prepare('INSERT INTO credit_ledger (id,account_id,generation_id,amount,reason,created_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), accountId, generationId, -amount, 'generation_reserved', now)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  refund(generationId: string, amount: number, accountId = 'demo-workspace') {
    database.exec('BEGIN IMMEDIATE')
    try {
      const now = new Date().toISOString()
      const inserted = database.prepare('INSERT OR IGNORE INTO credit_ledger (id,account_id,generation_id,amount,reason,created_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), accountId, generationId, amount, 'generation_refund', now)
      if (inserted.changes > 0) database.prepare('UPDATE credit_accounts SET balance=balance+?, updated_at=? WHERE id=?').run(amount, now, accountId)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}

export class AssetRepository {
  insert(asset: AssetRecord) {
    database.prepare('INSERT OR IGNORE INTO assets (id,generation_id,kind,mime_type,storage_key,metadata_json,created_at,workspace_id,project_id) VALUES (?,?,?,?,?,?,?,?,?)').run(asset.id, asset.generationId, asset.kind, asset.mimeType, asset.storageKey, JSON.stringify(asset.metadata), asset.createdAt, asset.workspaceId, asset.projectId)
  }
  list() {
    const rows = database.prepare('SELECT a.id,a.generation_id as generationId,a.kind,a.mime_type as mimeType,a.storage_key as storageKey,a.metadata_json as metadataJson,a.created_at as createdAt,a.workspace_id as workspaceId,a.project_id as projectId,g.input_json as inputJson FROM assets a JOIN generation_jobs g ON g.id=a.generation_id ORDER BY a.created_at DESC LIMIT 100').all() as Array<Record<string, unknown>>
    return rows.map((row) => ({ ...row, metadata: JSON.parse(row.metadataJson as string), input: JSON.parse(row.inputJson as string), metadataJson: undefined, inputJson: undefined }))
  }
}

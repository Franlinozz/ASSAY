import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { Dossier } from '@xyndicate/assay-core'
import { newId } from './ids'

type DB = Database.Database

// Synchronous repo layer over better-sqlite3 (gotcha #4 — no async wrappers). One process, one file
// (data/assay.db); binaries live under data/files/. Every write is a plain prepared statement.

export type JobStatus = 'queued' | 'running' | 'done' | 'failed'
export type OrderStatus = 'settled' | 'failed'
export type SealStatus = 'unsealed' | 'pending' | 'sealed'

export interface FileRow {
  id: string
  dossierId: string | null
  name: string
  ext: string
  mime: string
  path: string
  bytes: number
  createdAt: string
}

export interface OrderRow {
  id: string
  tool: string
  priceUsdt: number
  payerRef: string | null
  idempotencyKey: string
  status: OrderStatus
  result: string | null
  settlement: string | null
  createdAt: string
}

export interface JobRow {
  id: string
  kind: string
  status: JobStatus
  input: string | null
  resultRef: string | null
  result: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface SealRow {
  dossierId: string
  leaf: string
  attempts: number
  lastError: string | null
  enqueuedAt: string
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
}

const nowIso = (): string => new Date().toISOString()

export class Store {
  private readonly db: DB
  constructor(
    dbPath: string,
    private readonly filesDir: string,
  ) {
    if (dbPath !== ':memory:') {
      const dir = dbPath.slice(0, dbPath.lastIndexOf('/'))
      if (dir) mkdirSync(dir, { recursive: true })
    }
    mkdirSync(this.filesDir, { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        seal_status TEXT NOT NULL DEFAULT 'unsealed',
        salt TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        dossier_id TEXT,
        name TEXT NOT NULL,
        ext TEXT NOT NULL,
        mime TEXT NOT NULL,
        path TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        price_usdt REAL NOT NULL,
        payer_ref TEXT,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        result TEXT,
        settlement TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        input TEXT,
        result_ref TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS seals_pending (
        dossier_id TEXT PRIMARY KEY,
        leaf TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        enqueued_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS shares (
        slug TEXT PRIMARY KEY,
        dossier_id TEXT NOT NULL,
        file_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dossier_id TEXT,
        kind TEXT NOT NULL,
        detail TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_events_dossier ON events(dossier_id);
    `)
  }

  close(): void {
    this.db.close()
  }

  // ── dossiers ──
  saveDossier(dossier: Dossier, salt?: string): void {
    this.db
      .prepare(
        `INSERT INTO dossiers (id, json, seal_status, salt, created_at)
         VALUES (@id, @json, @seal, @salt, @createdAt)
         ON CONFLICT(id) DO UPDATE SET json=excluded.json`,
      )
      .run({
        id: dossier.id,
        json: JSON.stringify(dossier),
        seal: dossier.seal ? 'pending' : 'unsealed',
        salt: salt ?? null,
        createdAt: dossier.createdAt ?? nowIso(),
      })
  }

  getDossier(id: string): Dossier | undefined {
    const row = this.db.prepare(`SELECT json FROM dossiers WHERE id = ?`).get(id) as
      { json: string } | undefined
    return row ? (JSON.parse(row.json) as Dossier) : undefined
  }

  getSalt(id: string): string | undefined {
    const row = this.db.prepare(`SELECT salt FROM dossiers WHERE id = ?`).get(id) as
      { salt: string | null } | undefined
    return row?.salt ?? undefined
  }

  setSealStatus(id: string, status: SealStatus): void {
    this.db.prepare(`UPDATE dossiers SET seal_status = ? WHERE id = ?`).run(status, id)
  }

  getSealStatus(id: string): SealStatus | undefined {
    const row = this.db.prepare(`SELECT seal_status FROM dossiers WHERE id = ?`).get(id) as
      { seal_status: SealStatus } | undefined
    return row?.seal_status
  }

  // ── files (binaries + HMAC signed URLs) ──
  putFile(input: { dossierId?: string; name: string; ext: string; bytes: Uint8Array }): FileRow {
    const id = newId('file')
    const path = join(this.filesDir, `${id}.${input.ext}`)
    writeFileSync(path, Buffer.from(input.bytes))
    const row: FileRow = {
      id,
      dossierId: input.dossierId ?? null,
      name: input.name,
      ext: input.ext,
      mime: MIME[input.ext] ?? 'application/octet-stream',
      path,
      bytes: input.bytes.byteLength,
      createdAt: nowIso(),
    }
    this.db
      .prepare(
        `INSERT INTO files (id, dossier_id, name, ext, mime, path, bytes, created_at)
         VALUES (@id, @dossierId, @name, @ext, @mime, @path, @bytes, @createdAt)`,
      )
      .run(row)
    return row
  }

  getFileMeta(id: string): FileRow | undefined {
    const r = this.db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
      | {
          id: string
          dossier_id: string | null
          name: string
          ext: string
          mime: string
          path: string
          bytes: number
          created_at: string
        }
      | undefined
    if (!r) return undefined
    return {
      id: r.id,
      dossierId: r.dossier_id,
      name: r.name,
      ext: r.ext,
      mime: r.mime,
      path: r.path,
      bytes: r.bytes,
      createdAt: r.created_at,
    }
  }

  readFileBytes(id: string): Buffer | undefined {
    const meta = this.getFileMeta(id)
    if (!meta || !existsSync(meta.path)) return undefined
    return readFileSync(meta.path)
  }

  // ── orders (payments + idempotency) ──
  getOrderByIdempotencyKey(key: string): OrderRow | undefined {
    const r = this.db.prepare(`SELECT * FROM orders WHERE idempotency_key = ?`).get(key) as
      | {
          id: string
          tool: string
          price_usdt: number
          payer_ref: string | null
          idempotency_key: string
          status: OrderStatus
          result: string | null
          settlement: string | null
          created_at: string
        }
      | undefined
    if (!r) return undefined
    return {
      id: r.id,
      tool: r.tool,
      priceUsdt: r.price_usdt,
      payerRef: r.payer_ref,
      idempotencyKey: r.idempotency_key,
      status: r.status,
      result: r.result,
      settlement: r.settlement,
      createdAt: r.created_at,
    }
  }

  createOrder(input: {
    tool: string
    priceUsdt: number
    idempotencyKey: string
    status: OrderStatus
    payerRef?: string
    settlement?: string
    result?: string
  }): OrderRow {
    const row: OrderRow = {
      id: newId('ord'),
      tool: input.tool,
      priceUsdt: input.priceUsdt,
      payerRef: input.payerRef ?? null,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      result: input.result ?? null,
      settlement: input.settlement ?? null,
      createdAt: nowIso(),
    }
    this.db
      .prepare(
        `INSERT INTO orders (id, tool, price_usdt, payer_ref, idempotency_key, status, result, settlement, created_at)
         VALUES (@id, @tool, @priceUsdt, @payerRef, @idempotencyKey, @status, @result, @settlement, @createdAt)`,
      )
      .run(row)
    return row
  }

  attachOrderResult(idempotencyKey: string, result: string): void {
    this.db
      .prepare(`UPDATE orders SET result = ? WHERE idempotency_key = ?`)
      .run(result, idempotencyKey)
  }

  // ── jobs (async work) ──
  createJob(kind: string, input: unknown): JobRow {
    const now = nowIso()
    const row: JobRow = {
      id: newId('job'),
      kind,
      status: 'queued',
      input: JSON.stringify(input),
      resultRef: null,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }
    this.db
      .prepare(
        `INSERT INTO jobs (id, kind, status, input, result_ref, result, error, created_at, updated_at)
                VALUES (@id, @kind, @status, @input, @resultRef, @result, @error, @createdAt, @updatedAt)`,
      )
      .run(row)
    return row
  }

  getJob(id: string): JobRow | undefined {
    const r = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
      | {
          id: string
          kind: string
          status: JobStatus
          input: string | null
          result_ref: string | null
          result: string | null
          error: string | null
          created_at: string
          updated_at: string
        }
      | undefined
    if (!r) return undefined
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      input: r.input,
      resultRef: r.result_ref,
      result: r.result,
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  // Atomically claim the oldest queued job (single-process; a transaction is enough).
  claimNextQueuedJob(): JobRow | undefined {
    const claim = this.db.transaction((): JobRow | undefined => {
      const r = this.db
        .prepare(`SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
        .get() as { id: string } | undefined
      if (!r) return undefined
      this.db
        .prepare(`UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?`)
        .run(nowIso(), r.id)
      return this.getJob(r.id)
    })
    return claim()
  }

  finishJob(
    id: string,
    patch: { status: JobStatus; resultRef?: string; result?: unknown; error?: string },
  ): void {
    this.db
      .prepare(
        `UPDATE jobs SET status=@status, result_ref=@resultRef, result=@result, error=@error, updated_at=@updatedAt WHERE id=@id`,
      )
      .run({
        id,
        status: patch.status,
        resultRef: patch.resultRef ?? null,
        result: patch.result === undefined ? null : JSON.stringify(patch.result),
        error: patch.error ?? null,
        updatedAt: nowIso(),
      })
  }

  // ── seals_pending (drained by the anchor worker) ──
  enqueueSeal(dossierId: string, leaf: string): void {
    this.db
      .prepare(
        `INSERT INTO seals_pending (dossier_id, leaf, attempts, enqueued_at)
                VALUES (?, ?, 0, ?) ON CONFLICT(dossier_id) DO UPDATE SET leaf=excluded.leaf`,
      )
      .run(dossierId, leaf, nowIso())
    this.setSealStatus(dossierId, 'pending')
  }

  listPendingSeals(): SealRow[] {
    const rows = this.db
      .prepare(`SELECT * FROM seals_pending ORDER BY enqueued_at ASC`)
      .all() as Array<{
      dossier_id: string
      leaf: string
      attempts: number
      last_error: string | null
      enqueued_at: string
    }>
    return rows.map((r) => ({
      dossierId: r.dossier_id,
      leaf: r.leaf,
      attempts: r.attempts,
      lastError: r.last_error,
      enqueuedAt: r.enqueued_at,
    }))
  }

  markSealAttempt(dossierId: string, error: string): void {
    this.db
      .prepare(
        `UPDATE seals_pending SET attempts = attempts + 1, last_error = ? WHERE dossier_id = ?`,
      )
      .run(error, dossierId)
  }

  removeSeal(dossierId: string): void {
    this.db.prepare(`DELETE FROM seals_pending WHERE dossier_id = ?`).run(dossierId)
  }

  // Oldest queue age in ms (for the /health alert), or 0 when the queue is empty.
  oldestSealAgeMs(now = Date.now()): number {
    const r = this.db
      .prepare(`SELECT enqueued_at FROM seals_pending ORDER BY enqueued_at ASC LIMIT 1`)
      .get() as { enqueued_at: string } | undefined
    return r ? now - new Date(r.enqueued_at).getTime() : 0
  }

  pendingSealCount(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM seals_pending`).get() as { n: number }).n
  }

  // ── shares (portfolio slugs) ──
  createShare(dossierId: string, fileId?: string): string {
    const slug = newId('p')
    this.db
      .prepare(`INSERT INTO shares (slug, dossier_id, file_id, created_at) VALUES (?, ?, ?, ?)`)
      .run(slug, dossierId, fileId ?? null, nowIso())
    return slug
  }

  getShare(slug: string): { dossierId: string; fileId: string | null } | undefined {
    const r = this.db.prepare(`SELECT dossier_id, file_id FROM shares WHERE slug = ?`).get(slug) as
      { dossier_id: string; file_id: string | null } | undefined
    return r ? { dossierId: r.dossier_id, fileId: r.file_id } : undefined
  }

  // ── events (append-only per-dossier log) ──
  recordEvent(kind: string, detail?: unknown, dossierId?: string): void {
    this.db
      .prepare(`INSERT INTO events (dossier_id, kind, detail, at) VALUES (?, ?, ?, ?)`)
      .run(
        dossierId ?? null,
        kind,
        detail === undefined ? null : typeof detail === 'string' ? detail : JSON.stringify(detail),
        nowIso(),
      )
  }

  listEvents(dossierId: string): Array<{ kind: string; detail: string | null; at: string }> {
    return this.db
      .prepare(`SELECT kind, detail, at FROM events WHERE dossier_id = ? ORDER BY id ASC`)
      .all(dossierId) as Array<{ kind: string; detail: string | null; at: string }>
  }
}

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
  requestHash: string | null
  status: OrderStatus
  result: string | null
  settlement: string | null
  createdAt: string
  /** When the paid response was actually flushed to the buyer; null means they never got it. */
  deliveredAt: string | null
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

interface OrderRecord {
  id: string
  tool: string
  price_usdt: number
  payer_ref: string | null
  idempotency_key: string
  request_hash: string | null
  status: OrderStatus
  result: string | null
  settlement: string | null
  created_at: string
  delivered_at: string | null
}

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
    this.db.pragma('busy_timeout = 2000')
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
      CREATE TABLE IF NOT EXISTS dossier_versions (
        dossier_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        json TEXT NOT NULL,
        salt TEXT,
        seal_status TEXT NOT NULL DEFAULT 'unsealed',
        leaf TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (dossier_id, version)
      );
      CREATE TABLE IF NOT EXISTS evidence_redactions (
        dossier_id TEXT NOT NULL,
        evidence_id TEXT NOT NULL,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (dossier_id, evidence_id)
      );
      CREATE TABLE IF NOT EXISTS share_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_slug TEXT NOT NULL,
        viewed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_events_dossier ON events(dossier_id);
      CREATE INDEX IF NOT EXISTS idx_share_views_slug ON share_views(share_slug);
    `)
    // P9 Studio columns — added idempotently so the live prod DB (existing dossiers/shares) is
    // never dropped. SQLite has no ADD COLUMN IF NOT EXISTS, so we check table_info first.
    this.ensureColumn('dossiers', 'stage', "TEXT NOT NULL DEFAULT 'ledger'")
    this.ensureColumn('dossiers', 'email', 'TEXT')
    this.ensureColumn('shares', 'config', 'TEXT')
    this.ensureColumn('shares', 'revoked', 'INTEGER NOT NULL DEFAULT 0')
    this.ensureColumn('shares', 'expires_at', 'TEXT')
    // Bind an idempotency key to the exact paid operation. A completed response may be recovered
    // without resending a payment proof, but the same key can never be reused for different input.
    this.ensureColumn('orders', 'request_hash', 'TEXT')
    // Did the buyer actually RECEIVE what they paid for? Settlement proves money moved; only a
    // flushed response proves delivery. Recording the difference is what makes an undelivered
    // purchase recoverable instead of merely regrettable.
    this.ensureColumn('orders', 'delivered_at', 'TEXT')
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_orders_recovery ON orders(tool, request_hash, delivered_at)`,
    )
  }

  private ensureColumn(table: string, column: string, decl: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
    }
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
    const ref = parseVersionRef(id)
    if (ref) {
      const row = this.db
        .prepare(`SELECT salt FROM dossier_versions WHERE dossier_id = ? AND version = ?`)
        .get(ref.dossierId, ref.version) as { salt: string | null } | undefined
      return row?.salt ?? undefined
    }
    const row = this.db.prepare(`SELECT salt FROM dossiers WHERE id = ?`).get(id) as
      { salt: string | null } | undefined
    return row?.salt ?? undefined
  }

  setSealStatus(id: string, status: SealStatus): void {
    const ref = parseVersionRef(id)
    if (ref) {
      this.db
        .prepare(`UPDATE dossier_versions SET seal_status = ? WHERE dossier_id = ? AND version = ?`)
        .run(status, ref.dossierId, ref.version)
      const current = this.getDossier(ref.dossierId)
      if (current?.version === ref.version)
        this.db
          .prepare(`UPDATE dossiers SET seal_status = ? WHERE id = ?`)
          .run(status, ref.dossierId)
      return
    }
    this.db.prepare(`UPDATE dossiers SET seal_status = ? WHERE id = ?`).run(status, id)
  }

  getSealStatus(id: string): SealStatus | undefined {
    const ref = parseVersionRef(id)
    if (ref) {
      const row = this.db
        .prepare(`SELECT seal_status FROM dossier_versions WHERE dossier_id = ? AND version = ?`)
        .get(ref.dossierId, ref.version) as { seal_status: SealStatus } | undefined
      return row?.seal_status
    }
    const row = this.db.prepare(`SELECT seal_status FROM dossiers WHERE id = ?`).get(id) as
      { seal_status: SealStatus } | undefined
    return row?.seal_status
  }

  // Recent dossiers that reached the seal stage — anonymized upstream (id + status + time only).
  listRecentSealed(limit = 8): Array<{ id: string; sealStatus: SealStatus; createdAt: string }> {
    const rows = this.db
      .prepare(
        `SELECT id, seal_status, created_at FROM dossiers
         WHERE seal_status IN ('pending','sealed')
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as Array<{ id: string; seal_status: SealStatus; created_at: string }>
    return rows.map((r) => ({ id: r.id, sealStatus: r.seal_status, createdAt: r.created_at }))
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

  fileAvailable(id: string): boolean {
    const meta = this.getFileMeta(id)
    return !!meta && existsSync(meta.path)
  }

  // ── orders (payments + idempotency) ──
  private toOrderRow(r: OrderRecord | undefined): OrderRow | undefined {
    if (!r) return undefined
    return {
      id: r.id,
      tool: r.tool,
      priceUsdt: r.price_usdt,
      payerRef: r.payer_ref,
      idempotencyKey: r.idempotency_key,
      requestHash: r.request_hash,
      status: r.status,
      result: r.result,
      settlement: r.settlement,
      createdAt: r.created_at,
      deliveredAt: r.delivered_at ?? null,
    }
  }

  getOrderByIdempotencyKey(key: string): OrderRow | undefined {
    return this.toOrderRow(
      this.db.prepare(`SELECT * FROM orders WHERE idempotency_key = ?`).get(key) as
        | OrderRecord
        | undefined,
    )
  }

  /** Look an order up by the receipt handed back in-band when work outran the response budget. */
  getOrder(id: string): OrderRow | undefined {
    return this.toOrderRow(
      this.db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as OrderRecord | undefined,
    )
  }

  /**
   * A completed purchase for exactly this request that the buyer never received. Used to hand back
   * paid work on a retry rather than charging a second time for it — deliberately narrow: same
   * tool, same canonical arguments, a result on file, never delivered, and recent.
   */
  findUndeliveredOrder(tool: string, requestHash: string, maxAgeMs: number): OrderRow | undefined {
    const since = new Date(Date.now() - maxAgeMs).toISOString()
    return this.toOrderRow(
      this.db
        .prepare(
          `SELECT * FROM orders
            WHERE tool = ? AND request_hash = ? AND result IS NOT NULL
              AND delivered_at IS NULL AND created_at >= ?
            ORDER BY created_at DESC LIMIT 1`,
        )
        .get(tool, requestHash, since) as OrderRecord | undefined,
    )
  }

  markOrderDelivered(idempotencyKey: string): void {
    this.db
      .prepare(`UPDATE orders SET delivered_at = ? WHERE idempotency_key = ? AND delivered_at IS NULL`)
      .run(nowIso(), idempotencyKey)
  }

  orderCount(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM orders`).get() as { n: number }).n
  }

  createOrder(input: {
    tool: string
    priceUsdt: number
    idempotencyKey: string
    status: OrderStatus
    payerRef?: string
    requestHash?: string
    settlement?: string
    result?: string
  }): OrderRow {
    const row: OrderRow = {
      id: newId('ord'),
      tool: input.tool,
      priceUsdt: input.priceUsdt,
      payerRef: input.payerRef ?? null,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash ?? null,
      status: input.status,
      result: input.result ?? null,
      settlement: input.settlement ?? null,
      createdAt: nowIso(),
      deliveredAt: null,
    }
    this.db
      .prepare(
        `INSERT INTO orders (id, tool, price_usdt, payer_ref, idempotency_key, request_hash, status, result, settlement, created_at)
         VALUES (@id, @tool, @priceUsdt, @payerRef, @idempotencyKey, @requestHash, @status, @result, @settlement, @createdAt)`,
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

  recoverInterruptedJobs(): number {
    const result = this.db
      .prepare(
        `UPDATE jobs
         SET status = 'queued',
             error = 'interrupted:requeued',
             updated_at = ?
         WHERE status = 'running'`,
      )
      .run(nowIso())
    return result.changes
  }

  // ── seals_pending (drained by the anchor worker) ──
  enqueueSeal(dossierId: string, leaf: string, enqueuedAt = nowIso()): void {
    this.db
      .prepare(
        `INSERT INTO seals_pending (dossier_id, leaf, attempts, enqueued_at)
                VALUES (?, ?, 0, ?) ON CONFLICT(dossier_id) DO UPDATE SET leaf=excluded.leaf`,
      )
      .run(dossierId, leaf, enqueuedAt)
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

  // ── P9 Studio ─────────────────────────────────────────────────────────────
  // A dossier being built interactively in the browser. Stage/email live in columns; the evolving
  // Dossier (claims, evidence, brief, artifacts, reports, seal) lives in the json blob via saveDossier.

  createStudioDossier(dossier: Dossier, opts: { email?: string; salt?: string }): void {
    this.db
      .prepare(
        `INSERT INTO dossiers (id, json, seal_status, salt, stage, email, created_at)
         VALUES (@id, @json, 'unsealed', @salt, 'ledger', @email, @createdAt)`,
      )
      .run({
        id: dossier.id,
        json: JSON.stringify(dossier),
        salt: opts.salt ?? null,
        email: opts.email ?? null,
        createdAt: dossier.createdAt ?? nowIso(),
      })
  }

  setStage(id: string, stage: string): void {
    this.db.prepare(`UPDATE dossiers SET stage = ? WHERE id = ?`).run(stage, id)
  }

  getStage(id: string): string | undefined {
    const r = this.db.prepare(`SELECT stage FROM dossiers WHERE id = ?`).get(id) as
      { stage: string | null } | undefined
    return r?.stage ?? undefined
  }

  getEmail(id: string): string | undefined {
    const r = this.db.prepare(`SELECT email FROM dossiers WHERE id = ?`).get(id) as
      { email: string | null } | undefined
    return r?.email ?? undefined
  }

  dossierExists(id: string): boolean {
    return !!this.db.prepare(`SELECT 1 FROM dossiers WHERE id = ?`).get(id)
  }

  setSalt(id: string, salt: string): void {
    this.db.prepare(`UPDATE dossiers SET salt = ? WHERE id = ?`).run(salt, id)
  }

  // ── P13 version lineage ──────────────────────────────────────────────────
  saveDossierVersion(
    dossier: Dossier,
    opts: { salt?: string; leaf?: string; sealStatus?: SealStatus } = {},
  ): void {
    this.db
      .prepare(
        `INSERT INTO dossier_versions
          (dossier_id, version, json, salt, seal_status, leaf, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(dossier_id, version) DO UPDATE SET
           json=excluded.json,
           salt=COALESCE(excluded.salt, dossier_versions.salt),
           seal_status=excluded.seal_status,
           leaf=COALESCE(excluded.leaf, dossier_versions.leaf)`,
      )
      .run(
        dossier.id,
        dossier.version,
        JSON.stringify(dossier),
        opts.salt ?? null,
        opts.sealStatus ?? (dossier.seal ? 'pending' : 'unsealed'),
        opts.leaf ?? dossier.seal?.commitment ?? null,
        nowIso(),
      )
  }

  getDossierVersion(dossierId: string, version: number): Dossier | undefined {
    const row = this.db
      .prepare(`SELECT json FROM dossier_versions WHERE dossier_id = ? AND version = ?`)
      .get(dossierId, version) as { json: string } | undefined
    return row ? (JSON.parse(row.json) as Dossier) : undefined
  }

  listDossierVersions(dossierId: string): Array<{
    version: number
    sealStatus: SealStatus
    leaf: string | null
    createdAt: string
  }> {
    const rows = this.db
      .prepare(
        `SELECT version, seal_status, leaf, created_at
         FROM dossier_versions WHERE dossier_id = ? ORDER BY version ASC`,
      )
      .all(dossierId) as Array<{
      version: number
      seal_status: SealStatus
      leaf: string | null
      created_at: string
    }>
    return rows.map((r) => ({
      version: r.version,
      sealStatus: r.seal_status,
      leaf: r.leaf,
      createdAt: r.created_at,
    }))
  }

  latestDossierVersion(dossierId: string): number {
    const row = this.db
      .prepare(`SELECT MAX(version) AS version FROM dossier_versions WHERE dossier_id = ?`)
      .get(dossierId) as { version: number | null }
    return row.version ?? 0
  }

  // ── P13 redactions ───────────────────────────────────────────────────────
  setEvidenceRedactions(dossierId: string, evidenceId: string, redactions: unknown): void {
    this.db
      .prepare(
        `INSERT INTO evidence_redactions (dossier_id, evidence_id, json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(dossier_id, evidence_id) DO UPDATE SET
           json=excluded.json, updated_at=excluded.updated_at`,
      )
      .run(dossierId, evidenceId, JSON.stringify(redactions), nowIso())
  }

  getEvidenceRedactions(dossierId: string): Record<string, unknown> {
    const rows = this.db
      .prepare(`SELECT evidence_id, json FROM evidence_redactions WHERE dossier_id = ?`)
      .all(dossierId) as Array<{ evidence_id: string; json: string }>
    return Object.fromEntries(rows.map((r) => [r.evidence_id, JSON.parse(r.json)]))
  }

  // A structured live-feed event ("role · action"), stored under kind 'studio' with a JSON detail.
  recordStudioEvent(dossierId: string, role: string, action: string): number {
    const info = this.db
      .prepare(`INSERT INTO events (dossier_id, kind, detail, at) VALUES (?, 'studio', ?, ?)`)
      .run(dossierId, JSON.stringify({ role, action }), nowIso())
    return Number(info.lastInsertRowid)
  }

  // Events after a cursor (id), for the incremental feed. Only 'studio' events carry role/action.
  listStudioEventsSince(
    dossierId: string,
    sinceId = 0,
  ): Array<{ id: number; role: string; action: string; at: string }> {
    const rows = this.db
      .prepare(
        `SELECT id, detail, at FROM events WHERE dossier_id = ? AND kind = 'studio' AND id > ? ORDER BY id ASC`,
      )
      .all(dossierId, sinceId) as Array<{ id: number; detail: string | null; at: string }>
    return rows.map((r) => {
      let role = 'System'
      let action = ''
      try {
        const d = JSON.parse(r.detail ?? '{}') as { role?: string; action?: string }
        role = d.role ?? role
        action = d.action ?? ''
      } catch {
        action = r.detail ?? ''
      }
      return { id: r.id, role, action, at: r.at }
    })
  }

  // ── rich shares (recruiter portal) ──
  createStudioShare(input: {
    dossierId: string
    fileId?: string
    config: unknown
    expiresAt?: string
  }): string {
    const slug = newId('s')
    this.db
      .prepare(
        `INSERT INTO shares (slug, dossier_id, file_id, config, revoked, expires_at, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        slug,
        input.dossierId,
        input.fileId ?? null,
        JSON.stringify(input.config ?? {}),
        input.expiresAt ?? null,
        nowIso(),
      )
    return slug
  }

  getShareFull(slug: string):
    | {
        dossierId: string
        fileId: string | null
        config: unknown
        revoked: boolean
        expiresAt: string | null
        createdAt: string
      }
    | undefined {
    const r = this.db
      .prepare(
        `SELECT dossier_id, file_id, config, revoked, expires_at, created_at FROM shares WHERE slug = ?`,
      )
      .get(slug) as
      | {
          dossier_id: string
          file_id: string | null
          config: string | null
          revoked: number
          expires_at: string | null
          created_at: string
        }
      | undefined
    if (!r) return undefined
    return {
      dossierId: r.dossier_id,
      fileId: r.file_id,
      config: r.config ? JSON.parse(r.config) : {},
      revoked: r.revoked === 1,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }
  }

  // The newest share for a dossier (a dossier has at most one active share link in the Studio).
  latestShareForDossier(dossierId: string): string | undefined {
    const r = this.db
      .prepare(
        `SELECT slug FROM shares WHERE dossier_id = ? AND config IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      )
      .get(dossierId) as { slug: string } | undefined
    return r?.slug
  }

  setShareRevoked(slug: string, revoked: boolean): void {
    this.db.prepare(`UPDATE shares SET revoked = ? WHERE slug = ?`).run(revoked ? 1 : 0, slug)
  }

  updateShareConfig(slug: string, config: unknown, expiresAt?: string | null): void {
    this.db
      .prepare(`UPDATE shares SET config = ?, expires_at = ? WHERE slug = ?`)
      .run(JSON.stringify(config ?? {}), expiresAt ?? null, slug)
  }

  recordShareView(slug: string, at = Date.now()): void {
    const coarse = new Date(at)
    coarse.setUTCMinutes(0, 0, 0)
    this.db
      .prepare(`INSERT INTO share_views (share_slug, viewed_at) VALUES (?, ?)`)
      .run(slug, coarse.toISOString())
  }

  shareViewLog(slug: string): { count: number; recent: string[] } {
    const count = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM share_views WHERE share_slug = ?`).get(slug) as {
        n: number
      }
    ).n
    const rows = this.db
      .prepare(
        `SELECT viewed_at FROM share_views WHERE share_slug = ?
         ORDER BY id DESC LIMIT 10`,
      )
      .all(slug) as Array<{ viewed_at: string }>
    return { count, recent: rows.map((r) => r.viewed_at) }
  }
}

export function versionRef(dossierId: string, version: number): string {
  return `${dossierId}@v${version}`
}

export function parseVersionRef(ref: string): { dossierId: string; version: number } | undefined {
  const match = ref.match(/^(.*)@v([1-9]\d*)$/)
  return match ? { dossierId: match[1]!, version: Number(match[2]) } : undefined
}

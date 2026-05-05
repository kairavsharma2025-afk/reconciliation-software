-- SQLite schema for the reconciliation app.
-- Idempotent: every CREATE uses IF NOT EXISTS. Column additions live in db/init.js.

CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL CHECK (source IN ('bank','gateway','ledger')),
  amount           REAL NOT NULL,
  reference_id     TEXT,
  transaction_date TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'unmatched'
                       CHECK (status IN ('matched','unmatched','mismatch')),
  match_group_id   TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_reference   ON transactions (reference_id);
CREATE INDEX IF NOT EXISTS idx_tx_amount_date ON transactions (amount, transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_source      ON transactions (source);
CREATE INDEX IF NOT EXISTS idx_tx_status      ON transactions (status);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  total_scanned   INTEGER,
  matched_count   INTEGER,
  mismatch_count  INTEGER,
  unmatched_count INTEGER
  -- job_id and report columns are added by db/init.js for backwards compat
);

-- Per-run snapshot of every transaction's outcome. Each run gets its own
-- copy so historical reports remain accurate even if you re-reconcile later.
CREATE TABLE IF NOT EXISTS run_results (
  run_id           TEXT NOT NULL,
  transaction_id   TEXT NOT NULL,
  source           TEXT NOT NULL,
  amount           REAL NOT NULL,
  reference_id     TEXT,
  transaction_date TEXT NOT NULL,
  status           TEXT NOT NULL,
  match_group_id   TEXT,
  notes            TEXT,
  PRIMARY KEY (run_id, transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_run_results_run    ON run_results (run_id);
CREATE INDEX IF NOT EXISTS idx_run_results_status ON run_results (run_id, status);

-- Append-only audit trail. NEVER updated, NEVER deleted (except by ops/cleanup).
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  request_id  TEXT,
  actor       TEXT NOT NULL DEFAULT 'system',
  ip          TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    TEXT,
  result      TEXT NOT NULL DEFAULT 'success'
                   CHECK (result IN ('success','failure','warning'))
);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log (target_type, target_id);

-- Background job queue. Workers poll for status='pending' and next_run_at <= now().
-- dedupe_key (UNIQUE) prevents enqueuing duplicate work.
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','succeeded','failed','dead')),
  payload      TEXT,
  result       TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_run_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  started_at   TEXT,
  finished_at  TEXT,
  dedupe_key   TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs (status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type    ON jobs (type, created_at DESC);
-- Only one ACTIVE job per dedupe_key. Completed jobs don't block re-enqueue.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_active
  ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('pending','running');

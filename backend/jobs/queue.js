const { v4: uuid } = require('uuid');
const { db, withTransaction } = require('../config/db');
const { backoffMs } = require('./retry');

// Job lifecycle:
//   pending  → claim() → running → complete()    → succeeded
//                                  → fail()      → pending (retry) | dead (out of attempts)
//
// All state changes happen inside transactions to avoid two workers grabbing
// the same row. (Single SQLite writer makes that easy.)

const enqueueStmt = db.prepare(`
  INSERT INTO jobs (id, type, payload, max_attempts, dedupe_key)
  VALUES (?, ?, ?, ?, ?)
`);

const findByDedupe = db.prepare(`
  SELECT * FROM jobs
  WHERE dedupe_key = ? AND status IN ('pending','running')
  LIMIT 1
`);

function enqueue({ type, payload, maxAttempts = 3, dedupeKey = null }) {
  if (dedupeKey) {
    const existing = findByDedupe.get(dedupeKey);
    if (existing) return hydrate(existing);
  }
  const id = uuid();
  enqueueStmt.run(id, type, payload ? JSON.stringify(payload) : null, maxAttempts, dedupeKey);
  return getById(id);
}

const getStmt = db.prepare(`SELECT * FROM jobs WHERE id = ?`);
function getById(id) {
  const row = getStmt.get(id);
  return row ? hydrate(row) : null;
}

const claimNext = withTransaction(() => {
  // Wrap next_run_at in datetime() so ISO ('2026-05-05T06:38:11.535Z') and
  // SQLite-native ('2026-05-05 06:38:11') formats compare correctly.
  const row = db.prepare(`
    SELECT * FROM jobs
    WHERE status = 'pending' AND datetime(next_run_at) <= datetime('now')
    ORDER BY datetime(next_run_at), created_at
    LIMIT 1
  `).get();
  if (!row) return null;
  db.prepare(`
    UPDATE jobs
       SET status='running', started_at=datetime('now'), attempts=attempts+1
     WHERE id=?
  `).run(row.id);
  return hydrate({ ...row, status: 'running', attempts: row.attempts + 1 });
});

function complete(id, result) {
  db.prepare(`
    UPDATE jobs
       SET status='succeeded', finished_at=datetime('now'), result=?, last_error=NULL
     WHERE id=?
  `).run(result ? JSON.stringify(result) : null, id);
}

function fail(id, errorMessage, attempts, maxAttempts) {
  if (attempts >= maxAttempts) {
    db.prepare(`
      UPDATE jobs
         SET status='dead', finished_at=datetime('now'), last_error=?
       WHERE id=?
    `).run(errorMessage, id);
    return { dead: true };
  }
  // Match SQLite's native datetime format so future indexes/comparisons stay tidy.
  const nextRunAt = new Date(Date.now() + backoffMs(attempts))
    .toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(`
    UPDATE jobs
       SET status='pending', next_run_at=?, last_error=?
     WHERE id=?
  `).run(nextRunAt, errorMessage, id);
  return { dead: false, nextRunAt };
}

// On worker startup, any 'running' job is orphaned (the previous process died).
// Push it back to pending so it retries.
function recoverOrphaned() {
  const result = db.prepare(`
    UPDATE jobs SET status='pending', last_error='recovered after worker restart'
    WHERE status='running'
  `).run();
  return result.changes;
}

function list({ type, status, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (type)   { where.push('type = ?');   params.push(type); }
  if (status) { where.push('status = ?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 100, 1000));
  const rows = db.prepare(`
    SELECT * FROM jobs ${clause}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params);
  return rows.map(hydrate);
}

function hydrate(row) {
  return {
    ...row,
    payload: row.payload ? JSON.parse(row.payload) : null,
    result: row.result ? JSON.parse(row.result) : null,
  };
}

module.exports = { enqueue, getById, claimNext, complete, fail, recoverOrphaned, list };

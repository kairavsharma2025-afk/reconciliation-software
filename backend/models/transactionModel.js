const { v4: uuid } = require('uuid');
const { db, withTransaction } = require('../config/db');

// node:sqlite is synchronous. Controllers still `await` these calls — that's
// harmless: awaiting a plain value resolves immediately.

const bulkInsert = withTransaction((rows) => {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(`
    INSERT INTO transactions (id, source, amount, reference_id, transaction_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const r of rows) {
    stmt.run(uuid(), r.source, Number(r.amount), r.reference_id || null, r.transaction_date);
  }
  return rows.length;
});

function findAll({ status, source, limit = 500 } = {}) {
  const conditions = [];
  const params = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (source) { conditions.push('source = ?'); params.push(source); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 500, 5000));

  return db.prepare(`
    SELECT id, source, amount, reference_id, transaction_date, status, match_group_id, notes, created_at
    FROM transactions
    ${where}
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT ?
  `).all(...params);
}

function getStats() {
  return db.prepare(`
    SELECT
      COUNT(*)                                                  AS total,
      SUM(CASE WHEN status = 'matched'   THEN 1 ELSE 0 END)     AS matched,
      SUM(CASE WHEN status = 'unmatched' THEN 1 ELSE 0 END)     AS unmatched,
      SUM(CASE WHEN status = 'mismatch'  THEN 1 ELSE 0 END)     AS mismatches,
      SUM(CASE WHEN source = 'bank'      THEN 1 ELSE 0 END)     AS bank_count,
      SUM(CASE WHEN source = 'gateway'   THEN 1 ELSE 0 END)     AS gateway_count,
      SUM(CASE WHEN source = 'ledger'    THEN 1 ELSE 0 END)     AS ledger_count
    FROM transactions
  `).get();
}

// Reset everything EXCEPT manual links. A manual link is identified by its
// notes starting with 'Manual link' and status='matched'. Preserving them
// across reconciliation runs is the whole point of manual linking.
function resetStatuses() {
  db.prepare(`
    UPDATE transactions
    SET status = 'unmatched', match_group_id = NULL, notes = NULL
    WHERE NOT (status = 'matched' AND notes LIKE 'Manual link%')
  `).run();
}

// Auto-matcher only sees rows that aren't already manually matched.
function fetchAllForRun() {
  return db.prepare(`
    SELECT id, source, amount, reference_id, transaction_date
    FROM transactions
    WHERE NOT (status = 'matched' AND notes LIKE 'Manual link%')
    ORDER BY transaction_date, created_at
  `).all();
}

function countByIds(ids) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(
    `SELECT COUNT(*) AS n FROM transactions WHERE id IN (${placeholders})`
  ).get(...ids).n;
}

function manualLink(ids, groupId, note) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`
    UPDATE transactions
       SET status = 'matched', match_group_id = ?, notes = ?
     WHERE id IN (${placeholders})
  `).run(groupId, note, ...ids);
  return result.changes;
}

function unlinkGroup(groupId) {
  const result = db.prepare(`
    UPDATE transactions
       SET status = 'unmatched', match_group_id = NULL, notes = ?
     WHERE match_group_id = ?
  `).run('Manually unlinked — needs reconciliation', groupId);
  return result.changes;
}

function applyMatchGroup(ids, groupId, status, notes) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`
    UPDATE transactions
       SET status = ?, match_group_id = ?, notes = ?
     WHERE id IN (${placeholders})
  `).run(status, groupId, notes || null, ...ids);
}

function deleteAll() {
  db.prepare('DELETE FROM transactions').run();
  db.prepare('DELETE FROM reconciliation_runs').run();
}

module.exports = {
  bulkInsert,
  findAll,
  getStats,
  resetStatuses,
  fetchAllForRun,
  applyMatchGroup,
  deleteAll,
  countByIds,
  manualLink,
  unlinkGroup,
};

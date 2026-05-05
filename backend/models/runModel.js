const { db } = require('../config/db');

function listRuns({ limit = 50 } = {}) {
  const rows = db.prepare(`
    SELECT id, started_at, finished_at, total_scanned, matched_count,
           mismatch_count, unmatched_count, job_id, report
    FROM reconciliation_runs
    ORDER BY started_at DESC
    LIMIT ?
  `).all(Math.min(Number(limit) || 50, 500));
  return rows.map(hydrate);
}

function getRun(id) {
  const row = db.prepare(`
    SELECT id, started_at, finished_at, total_scanned, matched_count,
           mismatch_count, unmatched_count, job_id, report
    FROM reconciliation_runs WHERE id = ?
  `).get(id);
  return row ? hydrate(row) : null;
}

function getRunRows(runId, { status } = {}) {
  const where = ['run_id = ?'];
  const params = [runId];
  if (status) { where.push('status = ?'); params.push(status); }
  return db.prepare(`
    SELECT transaction_id AS id, source, amount, reference_id,
           transaction_date, status, match_group_id, notes
    FROM run_results
    WHERE ${where.join(' AND ')}
    ORDER BY status, transaction_date
  `).all(...params);
}

function hydrate(row) {
  return { ...row, report: row.report ? JSON.parse(row.report) : null };
}

module.exports = { listRuns, getRun, getRunRows };

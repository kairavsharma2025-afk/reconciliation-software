const { v4: uuid } = require('uuid');
const { db, withTransaction } = require('../config/db');
const txModel = require('../models/transactionModel');
const audit = require('../audit/auditService');
const logger = require('../utils/logger');

const TOLERANCE = Number(process.env.AMOUNT_TOLERANCE || 0.01);
const DATE_WINDOW_DAYS = Number(process.env.DATE_WINDOW_DAYS || 1);

// Wrapped in a transaction so a failure rolls back the whole match-and-snapshot.
const _runReconciliation = withTransaction((opts = {}) => {
  const runId = uuid();
  const startedAt = new Date().toISOString();
  const jobId = opts.jobId || null;

  db.prepare(`
    INSERT INTO reconciliation_runs (id, started_at, job_id) VALUES (?, ?, ?)
  `).run(runId, startedAt, jobId);

  txModel.resetStatuses();
  const all = txModel.fetchAllForRun();
  logger.info(`Reconciling ${all.length} transactions`, { runId, jobId });

  const remaining = new Map(all.map((t) => [t.id, t]));
  processByReference(remaining);
  processByFuzzyAmountDate(remaining);
  annotateOrphans(remaining, all); // explain WHY each leftover is unmatched

  // Snapshot every transaction's outcome so reports stay accurate even after
  // future reconciliations reset statuses.
  db.prepare(`
    INSERT INTO run_results (
      run_id, transaction_id, source, amount, reference_id,
      transaction_date, status, match_group_id, notes
    )
    SELECT ?, id, source, amount, reference_id,
           transaction_date, status, match_group_id, notes
    FROM transactions
  `).run(runId);

  // Pull final state from the DB — this includes manual links the auto-pass
  // skipped, so the totals reflect the system, not just the auto-match work.
  const finalRows = db.prepare(`SELECT status, source, notes FROM transactions`).all();
  const total = finalRows.length;
  const matched = finalRows.filter((r) => r.status === 'matched').length;
  const mismatch = finalRows.filter((r) => r.status === 'mismatch').length;
  const unmatched = finalRows.filter((r) => r.status === 'unmatched').length;
  const report = buildReport(finalRows);

  db.prepare(`
    UPDATE reconciliation_runs
       SET finished_at = ?, total_scanned = ?, matched_count = ?,
           mismatch_count = ?, unmatched_count = ?, report = ?
     WHERE id = ?
  `).run(new Date().toISOString(), total, matched, mismatch, unmatched, JSON.stringify(report), runId);

  return { runId, total, matched, mismatch, unmatched, report };
});

function runReconciliation(opts = {}) {
  audit.log({
    action: 'reconcile.started',
    actor: opts.jobId ? 'worker' : 'api',
    targetType: opts.jobId ? 'job' : null,
    targetId: opts.jobId || null,
  });
  try {
    const result = _runReconciliation(opts);
    audit.log({
      action: 'reconcile.completed',
      actor: opts.jobId ? 'worker' : 'api',
      targetType: 'reconciliation_run',
      targetId: result.runId,
      metadata: {
        jobId: opts.jobId,
        totals: {
          total: result.total, matched: result.matched,
          mismatch: result.mismatch, unmatched: result.unmatched,
        },
      },
    });
    return result;
  } catch (err) {
    audit.log({
      action: 'reconcile.failed',
      actor: opts.jobId ? 'worker' : 'api',
      targetType: opts.jobId ? 'job' : null,
      targetId: opts.jobId || null,
      metadata: { error: err.message },
      result: 'failure',
    });
    throw err;
  }
}

// ---- Orphan annotation -------------------------------------------------------

// Anything still in `remaining` after the matching passes is genuinely
// unmatched. Stamp each row with a note explaining the gap so users on the
// dashboard can act on it instead of staring at a blank cell.
function annotateOrphans(remaining, allRows) {
  const refToSources = new Map();
  for (const r of allRows) {
    if (!r.reference_id) continue;
    if (!refToSources.has(r.reference_id)) refToSources.set(r.reference_id, new Set());
    refToSources.get(r.reference_id).add(r.source);
  }

  const noteStmt = db.prepare(`UPDATE transactions SET notes = ? WHERE id = ?`);
  const allSources = ['bank', 'gateway', 'ledger'];

  for (const tx of remaining.values()) {
    let note;
    if (tx.reference_id) {
      // Survives only if its ref appears in just one source (the ref-id pass
      // groups any cross-source ref hits and routes them to matched/mismatch).
      const sources = refToSources.get(tx.reference_id) || new Set([tx.source]);
      const missing = allSources.filter((s) => !sources.has(s));
      note = `Orphan: reference ${tx.reference_id} only present in ${tx.source}; missing from ${missing.join(', ')}`;
    } else {
      note = `Orphan: blank reference and no amount/date counterpart within tolerance ${TOLERANCE} and ±${DATE_WINDOW_DAYS}-day window`;
    }
    noteStmt.run(note, tx.id);
  }
}

// ---- Report builder ----------------------------------------------------------

function buildReport(rows) {
  const byStatus = { matched: 0, unmatched: 0, mismatch: 0 };
  const bySource = { bank: 0, gateway: 0, ledger: 0 };
  const reasonCounts = new Map();

  for (const r of rows) {
    if (byStatus[r.status] !== undefined) byStatus[r.status]++;
    if (bySource[r.source] !== undefined) bySource[r.source]++;
    if (r.status === 'mismatch' && r.notes) {
      const key = extractReasonKey(r.notes);
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    }
  }

  const topMismatchReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const total = rows.length;
  const matchRate = total ? byStatus.matched / total : 0;
  return {
    matchRate: Math.round(matchRate * 1000) / 1000,
    total,
    byStatus,
    bySource,
    topMismatchReasons,
  };
}

// "Reference TXN1003: amount mismatch: 899.99 vs 890" → "amount mismatch"
function extractReasonKey(notes) {
  const colon = notes.indexOf(':');
  if (colon < 0) return notes;
  const tail = notes.slice(colon + 1).trim();
  const semi = tail.indexOf(';');
  const head = (semi < 0 ? tail : tail.slice(0, semi)).trim();
  const c2 = head.indexOf(':');
  return (c2 < 0 ? head : head.slice(0, c2)).trim();
}

// ---- Matching passes (unchanged from prior version) --------------------------

function processByReference(remaining) {
  const byRef = new Map();
  for (const tx of remaining.values()) {
    if (!tx.reference_id) continue;
    if (!byRef.has(tx.reference_id)) byRef.set(tx.reference_id, []);
    byRef.get(tx.reference_id).push(tx);
  }

  let matched = 0;
  let mismatch = 0;

  for (const [ref, group] of byRef.entries()) {
    if (group.length < 2) continue;

    const sources = new Set(group.map((g) => g.source));
    const amounts = group.map((g) => Number(g.amount));
    const allAmountsAgree = amounts.every((a) => Math.abs(a - amounts[0]) <= TOLERANCE);
    const datesAgree = group.every((g) => sameDate(g.transaction_date, group[0].transaction_date));

    const groupId = uuid();
    const ids = group.map((g) => g.id);

    if (allAmountsAgree && datesAgree && sources.size >= 2) {
      const note = sources.size === 3
        ? 'Matched across bank, gateway, and ledger'
        : `Matched across ${[...sources].join(' + ')}`;
      txModel.applyMatchGroup(ids, groupId, 'matched', note);
      matched += ids.length;
    } else {
      const reasons = [];
      if (!allAmountsAgree) reasons.push(`amount mismatch: ${amounts.join(' vs ')}`);
      if (!datesAgree) reasons.push('date mismatch');
      if (group.length > sources.size) reasons.push('duplicate entries on same source');
      txModel.applyMatchGroup(
        ids, groupId, 'mismatch',
        `Reference ${ref}: ${reasons.join('; ') || 'inconsistent'}`
      );
      mismatch += ids.length;
    }

    for (const id of ids) remaining.delete(id);
  }

  return { matched, mismatch };
}

function processByFuzzyAmountDate(remaining) {
  const bySource = { bank: [], gateway: [], ledger: [] };
  for (const tx of remaining.values()) bySource[tx.source].push(tx);

  let matched = 0;
  const consumed = new Set();

  for (const b of bySource.bank) {
    if (consumed.has(b.id)) continue;
    const g = bySource.gateway.find((x) => !consumed.has(x.id) && near(b, x));
    const l = bySource.ledger.find((x) => !consumed.has(x.id) && near(b, x));

    if (g && l) {
      const groupId = uuid();
      txModel.applyMatchGroup(
        [b.id, g.id, l.id], groupId, 'matched',
        'Fuzzy match (amount + date window) across all three sources'
      );
      consumed.add(b.id); consumed.add(g.id); consumed.add(l.id);
      matched += 3;
      continue;
    }
    if (g) {
      const groupId = uuid();
      txModel.applyMatchGroup(
        [b.id, g.id], groupId, 'matched',
        'Fuzzy match (amount + date window) bank ↔ gateway'
      );
      consumed.add(b.id); consumed.add(g.id);
      matched += 2;
      continue;
    }
    if (l) {
      const groupId = uuid();
      txModel.applyMatchGroup(
        [b.id, l.id], groupId, 'matched',
        'Fuzzy match (amount + date window) bank ↔ ledger'
      );
      consumed.add(b.id); consumed.add(l.id);
      matched += 2;
    }
  }

  for (const g of bySource.gateway) {
    if (consumed.has(g.id)) continue;
    const l = bySource.ledger.find((x) => !consumed.has(x.id) && near(g, x));
    if (l) {
      const groupId = uuid();
      txModel.applyMatchGroup(
        [g.id, l.id], groupId, 'matched',
        'Fuzzy match (amount + date window) gateway ↔ ledger'
      );
      consumed.add(g.id); consumed.add(l.id);
      matched += 2;
    }
  }

  for (const id of consumed) remaining.delete(id);
  return { matched, mismatch: 0 };
}

function near(a, b) {
  if (a.source === b.source) return false;
  const amountDiff = Math.abs(Number(a.amount) - Number(b.amount));
  if (amountDiff > TOLERANCE) return false;
  const days = Math.abs(daysBetween(a.transaction_date, b.transaction_date));
  return days <= DATE_WINDOW_DAYS;
}

function sameDate(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

module.exports = { runReconciliation };

const runModel = require('../models/runModel');
const audit = require('../audit/auditService');

async function listRuns(req, res) {
  const runs = runModel.listRuns({ limit: req.query.limit });
  res.json({ ok: true, count: runs.length, runs });
}

async function getRun(req, res) {
  const run = runModel.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json({ ok: true, run });
}

async function getRunRows(req, res) {
  const run = runModel.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  const rows = runModel.getRunRows(req.params.id, { status: req.query.status });
  res.json({ ok: true, runId: run.id, count: rows.length, rows });
}

async function downloadRunCsv(req, res) {
  const run = runModel.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  const rows = runModel.getRunRows(req.params.id);
  const csv = rowsToCsv(rows);

  audit.log({
    action: 'report.export.csv',
    context: req.context,
    targetType: 'reconciliation_run',
    targetId: run.id,
    metadata: { rowCount: rows.length },
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${run.id.slice(0, 8)}.csv"`);
  res.send(csv);
}

function rowsToCsv(rows) {
  const headers = ['source', 'reference_id', 'amount', 'transaction_date', 'status', 'match_group_id', 'notes'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

module.exports = { listRuns, getRun, getRunRows, downloadRunCsv };

const { v4: uuid } = require('uuid');
const txModel = require('../models/transactionModel');
const audit = require('../audit/auditService');

async function listTransactions(req, res) {
  const { status, source, limit } = req.query;
  const allowedStatus = ['matched', 'unmatched', 'mismatch'];
  const allowedSource = ['bank', 'gateway', 'ledger'];

  const filters = {};
  if (status && allowedStatus.includes(status)) filters.status = status;
  if (source && allowedSource.includes(source)) filters.source = source;
  if (limit) filters.limit = Math.min(Number(limit) || 500, 5000);

  const rows = await txModel.findAll(filters);
  res.json({ ok: true, count: rows.length, rows });
}

// Manually link 2+ transactions as a single match group. Survives reconciliations.
async function linkTransactions(req, res) {
  const { ids, note } = req.body || {};
  if (!Array.isArray(ids) || ids.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 transaction ids' });
  }
  if (ids.length > 10) {
    return res.status(400).json({ error: 'Cannot link more than 10 rows at once' });
  }
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Duplicate ids in request' });
  }
  const found = txModel.countByIds(ids);
  if (found !== ids.length) {
    return res.status(400).json({ error: 'One or more transaction ids not found' });
  }

  const groupId = uuid();
  const actor = req.context.actor;
  const safeNote = (note || '').toString().slice(0, 500); // cap length
  const noteText = `Manual link by ${actor}${safeNote ? ': ' + safeNote : ''}`;
  txModel.manualLink(ids, groupId, noteText);

  audit.log({
    action: 'transactions.linked',
    context: req.context,
    targetType: 'match_group',
    targetId: groupId,
    metadata: { ids, note: safeNote || null },
  });

  res.json({ ok: true, matchGroupId: groupId, linkedCount: ids.length });
}

async function unlinkTransactions(req, res) {
  const { matchGroupId } = req.body || {};
  if (!matchGroupId) {
    return res.status(400).json({ error: 'matchGroupId required' });
  }
  const changes = txModel.unlinkGroup(matchGroupId);
  if (changes === 0) {
    return res.status(404).json({ error: 'No rows found for that match group' });
  }
  audit.log({
    action: 'transactions.unlinked',
    context: req.context,
    targetType: 'match_group',
    targetId: matchGroupId,
    metadata: { affectedRows: changes },
  });
  res.json({ ok: true, unlinkedCount: changes });
}

module.exports = { listTransactions, linkTransactions, unlinkTransactions };

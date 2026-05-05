const audit = require('../audit/auditService');

async function listAudit(req, res) {
  const { action, targetType, targetId, limit } = req.query;
  const entries = audit.list({ action, targetType, targetId, limit });
  res.json({ ok: true, count: entries.length, entries });
}

module.exports = { listAudit };

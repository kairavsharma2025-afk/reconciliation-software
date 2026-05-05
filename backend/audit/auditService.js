const { v4: uuid } = require('uuid');
const { db } = require('../config/db');
const logger = require('../utils/logger');

const insertStmt = db.prepare(`
  INSERT INTO audit_log
    (id, ts, request_id, actor, ip, action, target_type, target_id, metadata, result)
  VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Single entry point for writing to the audit log. Never throw — auditing must
// not be able to break the calling request. We catch + warn instead.
function log({
  action,
  actor,
  ip,
  requestId,
  targetType,
  targetId,
  metadata,
  result,
  context,
}) {
  try {
    insertStmt.run(
      uuid(),
      requestId || context?.requestId || null,
      actor || context?.actor || 'system',
      ip || context?.ip || null,
      action,
      targetType || null,
      targetId || null,
      metadata ? JSON.stringify(metadata) : null,
      result || 'success'
    );
  } catch (err) {
    logger.warn('audit log failed', { action, err: err.message });
  }
}

function list({ action, targetType, targetId, limit = 200 } = {}) {
  const where = [];
  const params = [];
  if (action) { where.push('action = ?'); params.push(action); }
  if (targetType) { where.push('target_type = ?'); params.push(targetType); }
  if (targetId) { where.push('target_id = ?'); params.push(targetId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 200, 2000));

  const rows = db.prepare(`
    SELECT id, ts, request_id, actor, ip, action, target_type, target_id, metadata, result
    FROM audit_log ${clause}
    ORDER BY ts DESC
    LIMIT ?
  `).all(...params);

  return rows.map((r) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));
}

module.exports = { log, list };

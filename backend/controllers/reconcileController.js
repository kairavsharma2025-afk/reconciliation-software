const queue = require('../jobs/queue');
const audit = require('../audit/auditService');

// Reconciliation is now async: enqueue a background job and return its id.
// Clients (the dashboard) poll GET /api/jobs/:id to follow progress.
//
// dedupe_key 'reconcile:active' ensures only one reconcile is in-flight at a
// time — concurrent clicks coalesce onto the same job.
async function reconcile(req, res) {
  const job = queue.enqueue({
    type: 'reconcile',
    payload: { triggeredBy: req.context.actor, requestId: req.context.requestId },
    maxAttempts: Number(process.env.RECONCILE_MAX_ATTEMPTS || 3),
    dedupeKey: 'reconcile:active',
  });

  audit.log({
    action: 'reconcile.enqueued',
    context: req.context,
    targetType: 'job',
    targetId: job.id,
    metadata: { coalescedTo: job.attempts > 0 ? job.id : undefined },
  });

  res.status(202).json({ ok: true, jobId: job.id, status: job.status });
}

module.exports = { reconcile };

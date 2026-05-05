const queue = require('./queue');
const audit = require('../audit/auditService');
const logger = require('../utils/logger');

const handlers = {
  reconcile: require('./handlers/reconcileJob'),
  flaky:     require('./handlers/flakyJob'), // retry self-test fixture
};

const POLL_MS = Number(process.env.WORKER_POLL_MS || 500);

let intervalHandle = null;
let draining = false;

async function tick() {
  if (draining) return;
  draining = true;
  try {
    while (true) {
      const job = queue.claimNext();
      if (!job) break;
      await runJob(job);
    }
  } catch (err) {
    logger.error('worker tick error', { err: err.message });
  } finally {
    draining = false;
  }
}

async function runJob(job) {
  const handler = handlers[job.type];
  audit.log({
    action: 'job.started',
    actor: 'worker',
    targetType: 'job',
    targetId: job.id,
    metadata: { type: job.type, attempt: job.attempts },
  });

  if (!handler) {
    const msg = `no handler for job type '${job.type}'`;
    queue.fail(job.id, msg, job.max_attempts, job.max_attempts); // straight to dead
    audit.log({
      action: 'job.dead', actor: 'worker', targetType: 'job', targetId: job.id,
      metadata: { reason: msg }, result: 'failure',
    });
    return;
  }

  try {
    const result = await handler.run(job.payload || {}, { jobId: job.id, attempt: job.attempts });
    queue.complete(job.id, result);
    audit.log({
      action: 'job.succeeded', actor: 'worker', targetType: 'job', targetId: job.id,
      metadata: { type: job.type, attempt: job.attempts, result },
    });
    logger.info(`job ${job.id} (${job.type}) succeeded on attempt ${job.attempts}`);
  } catch (err) {
    const outcome = queue.fail(job.id, err.message, job.attempts, job.max_attempts);
    audit.log({
      action: outcome.dead ? 'job.dead' : 'job.failed',
      actor: 'worker', targetType: 'job', targetId: job.id,
      metadata: { type: job.type, attempt: job.attempts, error: err.message, nextRunAt: outcome.nextRunAt },
      result: 'failure',
    });
    logger.warn(`job ${job.id} (${job.type}) failed on attempt ${job.attempts}: ${err.message}`,
      { dead: outcome.dead, nextRunAt: outcome.nextRunAt });
  }
}

function start() {
  const recovered = queue.recoverOrphaned();
  if (recovered > 0) {
    logger.info(`recovered ${recovered} orphaned job(s) from previous run`);
  }
  intervalHandle = setInterval(tick, POLL_MS);
  logger.info(`background worker started (poll every ${POLL_MS}ms)`);
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = { start, stop, runJob }; // runJob exported for tests

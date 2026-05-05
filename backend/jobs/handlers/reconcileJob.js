const { runReconciliation } = require('../../services/reconcileService');

// Job handler signature: async run(payload, ctx) → result. Throw to trigger retry.
// Reconciliation itself is idempotent — re-running just re-evaluates the
// current transactions table — so retry is safe.
async function run(payload, ctx) {
  const result = runReconciliation({ jobId: ctx.jobId });
  return result;
}

module.exports = { run };

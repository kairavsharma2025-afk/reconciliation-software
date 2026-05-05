// Test fixture for the retry mechanism.
// Throws on the first `failUntil` attempts, then returns success.
// Used by scripts/test-retry.js — keep it; it's a built-in self-test.
async function run(payload, ctx) {
  const failUntil = Number(payload?.failUntil ?? 2);
  if (ctx.attempt <= failUntil) {
    throw new Error(`flaky failure on attempt ${ctx.attempt}/${failUntil}`);
  }
  return { okOnAttempt: ctx.attempt, payload };
}

module.exports = { run };

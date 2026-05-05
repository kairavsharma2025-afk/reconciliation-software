// Exponential backoff with jitter. Capped so a buggy job doesn't push next
// attempts hours into the future.
//
//   attempt 1 → ~1s
//   attempt 2 → ~2s
//   attempt 3 → ~4s
//   attempt N → min(60s, 2^N * 1s) + 0–500ms jitter
function backoffMs(attempt) {
  const baseMs = 1000;
  const capMs = 60_000;
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 500);
  return exp + jitter;
}

module.exports = { backoffMs };

// Enqueues a deliberately-failing job to exercise the retry mechanism.
// Usage: node scripts/test-retry.js [failUntil=2]
require('dotenv').config();
const queue = require('../jobs/queue');

const failUntil = Number(process.argv[2] || 2);
const job = queue.enqueue({
  type: 'flaky',
  payload: { failUntil },
  maxAttempts: failUntil + 1,
});
console.log(`enqueued flaky job ${job.id} — will fail ${failUntil} times, then succeed on attempt ${failUntil + 1}`);

const queue = require('../jobs/queue');

async function listJobs(req, res) {
  const { type, status, limit } = req.query;
  const jobs = queue.list({ type, status, limit });
  res.json({ ok: true, count: jobs.length, jobs });
}

async function getJob(req, res) {
  const job = queue.getById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ ok: true, job });
}

module.exports = { listJobs, getJob };

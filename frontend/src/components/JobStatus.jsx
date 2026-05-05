// Compact pill that shows a job's current state plus attempt count.
// Used inline in the "Run reconciliation" panel while a job is in flight.
export default function JobStatus({ job }) {
  if (!job) return null;
  const cls = `badge job-${job.status}`;
  const attemptInfo = job.max_attempts && job.attempts > 1
    ? ` · attempt ${job.attempts}/${job.max_attempts}`
    : '';
  return (
    <span className={cls} title={job.last_error || ''}>
      {job.status}{attemptInfo}
    </span>
  );
}

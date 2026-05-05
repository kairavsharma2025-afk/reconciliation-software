import { useEffect, useState } from 'react';
import { listRuns, runCsvUrl } from '../services/api.js';

export default function RunHistory({ refreshKey }) {
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    listRuns().then((r) => setRuns(r.data.runs)).catch(() => setRuns([]));
  }, [refreshKey]);

  if (runs.length === 0) {
    return <div className="empty">No reconciliation runs yet.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tx-table">
        <thead>
          <tr>
            <th>Started</th>
            <th>Total</th>
            <th>Matched</th>
            <th>Mismatch</th>
            <th>Unmatched</th>
            <th>Match rate</th>
            <th>Top mismatch reason</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const top = r.report?.topMismatchReasons?.[0];
            const rate = r.report?.matchRate != null
              ? `${Math.round(r.report.matchRate * 100)}%`
              : '—';
            return (
              <tr key={r.id}>
                <td>{formatTs(r.started_at)}</td>
                <td>{r.total_scanned ?? '—'}</td>
                <td>{r.matched_count ?? 0}</td>
                <td>{r.mismatch_count ?? 0}</td>
                <td>{r.unmatched_count ?? 0}</td>
                <td>{rate}</td>
                <td style={{ color: 'var(--muted)' }}>
                  {top ? `${top.reason} (${top.count})` : '—'}
                </td>
                <td>
                  <a href={runCsvUrl(r.id)} className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                    CSV
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatTs(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString();
}

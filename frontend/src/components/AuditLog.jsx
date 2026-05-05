import { useEffect, useState } from 'react';
import { listAudit } from '../services/api.js';

export default function AuditLog({ refreshKey }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    listAudit({ limit: 50 }).then((r) => setEntries(r.data.entries)).catch(() => setEntries([]));
  }, [refreshKey]);

  if (entries.length === 0) {
    return <div className="empty">No audit entries yet.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tx-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Result</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{formatTs(e.ts)}</td>
              <td>{e.actor}</td>
              <td><code>{e.action}</code></td>
              <td style={{ color: 'var(--muted)' }}>
                {e.target_type ? `${e.target_type}${e.target_id ? `:${e.target_id.slice(0, 8)}` : ''}` : '—'}
              </td>
              <td>
                <span className={`badge audit-${e.result}`}>{e.result}</span>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 380, wordBreak: 'break-word' }}>
                {e.metadata ? JSON.stringify(e.metadata) : ''}
              </td>
            </tr>
          ))}
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

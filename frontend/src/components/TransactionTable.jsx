// Renders the transactions list. Two optional capabilities:
//   - if `onToggleSelect` is supplied, a checkbox column appears (only enabled
//     for unmatched rows — those are the candidates for manual linking).
//   - if `onUnlink` is supplied, an "Unlink" button appears on rows whose
//     notes mark them as a manual link.
export default function TransactionTable({ rows, selectedIds = [], onToggleSelect, onUnlink }) {
  const selectable = typeof onToggleSelect === 'function';
  if (!rows || rows.length === 0) {
    return <div className="empty">No transactions to show. Upload CSVs and run reconciliation.</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tx-table">
        <thead>
          <tr>
            {selectable && <th style={{ width: 32 }}></th>}
            <th>Source</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
            <th>Notes</th>
            {onUnlink && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isManual = r.notes?.startsWith('Manual link');
            const canSelect = r.status === 'unmatched';
            return (
              <tr key={r.id}>
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => onToggleSelect(r.id)}
                      disabled={!canSelect}
                      title={canSelect ? '' : 'Only unmatched rows can be manually linked'}
                    />
                  </td>
                )}
                <td><span className={`badge ${r.source}`}>{r.source}</span></td>
                <td>{r.reference_id || <em style={{ color: 'var(--muted)' }}>—</em>}</td>
                <td>{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{new Date(r.transaction_date).toISOString().slice(0, 10)}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td style={{ color: 'var(--muted)' }}>{r.notes || ''}</td>
                {onUnlink && (
                  <td>
                    {isManual && r.match_group_id && (
                      <button
                        className="btn ghost"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => onUnlink(r.match_group_id)}
                        title="Break this manual link — affected rows return to unmatched"
                      >
                        Unlink
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

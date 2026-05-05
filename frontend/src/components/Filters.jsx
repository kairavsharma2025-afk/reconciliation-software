export default function Filters({ status, source, onChange }) {
  return (
    <div className="filter-bar">
      <select value={status} onChange={(e) => onChange({ status: e.target.value, source })}>
        <option value="">All statuses</option>
        <option value="matched">Matched</option>
        <option value="unmatched">Unmatched</option>
        <option value="mismatch">Mismatch</option>
      </select>
      <select value={source} onChange={(e) => onChange({ status, source: e.target.value })}>
        <option value="">All sources</option>
        <option value="bank">Bank</option>
        <option value="gateway">Gateway</option>
        <option value="ledger">Ledger</option>
      </select>
    </div>
  );
}

export default function StatsCards({ stats }) {
  if (!stats) return null;
  const cards = [
    { key: 'total',      label: 'Total transactions', value: stats.total },
    { key: 'matched',    label: 'Matched',            value: stats.matched,    cls: 'matched' },
    { key: 'unmatched',  label: 'Unmatched',          value: stats.unmatched,  cls: 'unmatched' },
    { key: 'mismatches', label: 'Mismatches',         value: stats.mismatches, cls: 'mismatch' },
    { key: 'bank',       label: 'From bank',          value: stats.bank_count },
    { key: 'gateway',    label: 'From gateway',       value: stats.gateway_count },
    { key: 'ledger',     label: 'From ledger',        value: stats.ledger_count },
  ];
  return (
    <div className="stats-grid">
      {cards.map((c) => (
        <div key={c.key} className={`stat-card ${c.cls || ''}`}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

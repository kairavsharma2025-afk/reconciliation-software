const fs = require('fs');
const csv = require('csv-parser');

// Expected CSV columns (case-insensitive): reference_id, amount, date  (or transaction_date)
// Returns: [{ reference_id, amount, transaction_date }]
function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
      .on('data', (raw) => {
        const reference_id = (raw.reference_id || raw.ref || raw.id || '').trim() || null;
        const rawAmount = raw.amount ?? raw.value ?? raw.txn_amount;
        const rawDate = raw.transaction_date ?? raw.date ?? raw.txn_date;

        const amount = Number(String(rawAmount).replace(/[, ]/g, ''));
        const transaction_date = parseDate(rawDate);

        if (Number.isNaN(amount) || !transaction_date) return; // skip malformed rows
        rows.push({ reference_id, amount, transaction_date });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  // Accept YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY (best effort).
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    let [a, b, c] = parts;
    if (c.length === 4) {
      // DD/MM/YYYY assumed
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    if (a.length === 4) {
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

module.exports = { parseCsv };

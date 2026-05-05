// Creates the SQLite file (if missing), applies schema.sql, and runs idempotent
// column-level migrations for upgrades. Safe to re-run any time.
// Usage: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_FILE
  ? path.resolve(__dirname, '..', process.env.DB_FILE)
  : path.join(__dirname, 'recon.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const db = new DatabaseSync(dbPath);
db.exec(sql);

// --- Additive migrations ------------------------------------------------------
function hasColumn(table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === col);
}

function addColumnIfMissing(table, col, def) {
  if (!hasColumn(table, col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    console.log(`migrated: added ${table}.${col}`);
  }
}

addColumnIfMissing('reconciliation_runs', 'job_id', 'TEXT');
addColumnIfMissing('reconciliation_runs', 'report', 'TEXT');

db.close();
console.log('SQLite DB initialized at', dbPath);

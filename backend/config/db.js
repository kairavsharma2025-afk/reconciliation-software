const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_FILE
  ? path.resolve(__dirname, '..', process.env.DB_FILE)
  : path.join(__dirname, '..', 'db', 'recon.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Apply schema + idempotent column migrations on every startup. Means a fresh
// host (Railway, Fly, etc.) needs no separate `db:init` step — bring up the
// process and it self-bootstraps.
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
}

function hasColumn(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}
if (!hasColumn('reconciliation_runs', 'job_id')) {
  db.exec(`ALTER TABLE reconciliation_runs ADD COLUMN job_id TEXT`);
}
if (!hasColumn('reconciliation_runs', 'report')) {
  db.exec(`ALTER TABLE reconciliation_runs ADD COLUMN report TEXT`);
}

function withTransaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* nothing to rollback */ }
      throw err;
    }
  };
}

module.exports = { db, withTransaction };

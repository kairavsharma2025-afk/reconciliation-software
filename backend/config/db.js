const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_FILE
  ? path.resolve(__dirname, '..', process.env.DB_FILE)
  : path.join(__dirname, '..', 'db', 'recon.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
// WAL: concurrent readers + single writer; safer for our app pattern.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Wrap a function in BEGIN/COMMIT/ROLLBACK. Keeps services free of boilerplate
// and guarantees we never leave the DB mid-write.
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

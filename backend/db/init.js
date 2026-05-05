// Standalone DB-bootstrap CLI. The server now self-bootstraps on startup
// (see config/db.js), so this script is mostly for explicit setup / verification.
// Usage: npm run db:init
require('dotenv').config();
require('../config/db'); // requiring it runs schema + migrations
console.log('SQLite DB initialized.');

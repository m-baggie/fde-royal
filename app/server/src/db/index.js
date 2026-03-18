const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./schema');
const { migrateVariants } = require('./migrate-variants');

// dam.sqlite lives at the project root (app/), three levels up from server/src/db/
const dbPath = path.join(__dirname, '../../../dam.sqlite');

let db;
try {
  db = new Database(dbPath);
  runMigrations(db);
  migrateVariants(db);
} catch (err) {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
}

module.exports = db;

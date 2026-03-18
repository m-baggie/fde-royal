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
  // US-001: add enriched_destination_region / enriched_content_type if absent
  const cols = db.prepare('PRAGMA table_info(assets)').all().map((c) => c.name);
  if (!cols.includes('enriched_destination_region')) {
    db.exec('ALTER TABLE assets ADD COLUMN enriched_destination_region TEXT');
  }
  if (!cols.includes('enriched_content_type')) {
    db.exec('ALTER TABLE assets ADD COLUMN enriched_content_type TEXT');
  }
} catch (err) {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
}

module.exports = db;

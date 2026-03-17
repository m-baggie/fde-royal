'use strict';

/**
 * Jest globalSetup — runs once before all test suites.
 * Ensures dam.sqlite is populated with the 49 real assets so supertest
 * tests that depend on data (GET /api/assets, etc.) work in a fresh worktree.
 *
 * Uses the same REAL_DATA_DIR path as ingest.test.js:
 *   server/ → app/ → feature-api/ → FDE/ → Royal Caribbean/Data/royal
 */
const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./src/db/schema');
const { ingestAssets } = require('./src/services/ingest');

module.exports = async function globalSetup() {
  const dbPath = path.resolve(__dirname, '../dam.sqlite');
  const dataDir = path.resolve(__dirname, '../../../Royal Caribbean/Data/royal');

  const db = new Database(dbPath);
  runMigrations(db);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM assets').get();
  if (n === 0) {
    ingestAssets(db, dataDir);
  }

  db.close();
};

const Database = require('better-sqlite3');
const { runMigrations } = require('../db/schema');

/**
 * With content='assets', FTS5 reads column values from the assets table
 * using FTS column names (title, description, …). Those names don't exist
 * in assets, so SELECT * would fail. Instead we SELECT rowid — a special
 * FTS5 field that is always available without touching the content table.
 * To verify which asset matched we compare rowid to lastInsertRowid.
 */
describe('runMigrations', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates assets table without error', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'")
      .get();
    expect(row).toBeTruthy();
    expect(row.name).toBe('assets');
  });

  it('creates assets_fts virtual table without error', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets_fts'")
      .get();
    expect(row).toBeTruthy();
    expect(row.name).toBe('assets_fts');
  });

  it('calling runMigrations twice does not throw', () => {
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('INSERT row → SELECT from assets_fts MATCH returns that row', () => {
    const info = db
      .prepare('INSERT INTO assets (id, filename, enriched_title) VALUES (?, ?, ?)')
      .run('asset-001', 'allure.jpg', 'Allure of the Seas Sunset');

    const rows = db
      .prepare('SELECT rowid FROM assets_fts WHERE assets_fts MATCH ?')
      .all('Allure');

    expect(rows.length).toBe(1);
    expect(rows[0].rowid).toBe(info.lastInsertRowid);
  });

  it('UPDATE assets row title → FTS reflects new title', () => {
    const info = db
      .prepare('INSERT INTO assets (id, filename, enriched_title) VALUES (?, ?, ?)')
      .run('asset-002', 'anthem.jpg', 'Old Title Here');

    db.prepare('UPDATE assets SET enriched_title = ? WHERE id = ?')
      .run('New Title Here', 'asset-002');

    const newRows = db
      .prepare('SELECT rowid FROM assets_fts WHERE assets_fts MATCH ?')
      .all('"New Title Here"');
    expect(newRows.length).toBe(1);
    expect(newRows[0].rowid).toBe(info.lastInsertRowid);

    const oldRows = db
      .prepare('SELECT rowid FROM assets_fts WHERE assets_fts MATCH ?')
      .all('"Old Title Here"');
    expect(oldRows.length).toBe(0);
  });

  it('DELETE assets row → FTS no longer returns it', () => {
    db.prepare('INSERT INTO assets (id, filename, enriched_title) VALUES (?, ?, ?)')
      .run('asset-003', 'grandeur.jpg', 'Grandeur Sailing Ship');

    db.prepare('DELETE FROM assets WHERE id = ?').run('asset-003');

    const rows = db
      .prepare('SELECT rowid FROM assets_fts WHERE assets_fts MATCH ?')
      .all('Grandeur');
    expect(rows.length).toBe(0);
  });
});

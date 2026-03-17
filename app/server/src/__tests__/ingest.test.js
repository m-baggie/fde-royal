'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const { runMigrations } = require('../db/schema');
const { ingestAssets } = require('../services/ingest');

// Absolute path to the real DAM export data (5 levels up from __tests__ → FDE/, then sibling repo)
const REAL_DATA_DIR = path.resolve(
  __dirname,
  '../../../../..',
  'Royal Caribbean/Data/royal'
);

function createTestDb() {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

describe('ingestAssets — real data', () => {
  let db;

  beforeAll(() => {
    db = createTestDb();
    ingestAssets(db, REAL_DATA_DIR);
  });

  afterAll(() => {
    db.close();
  });

  it('inserts exactly 49 rows', () => {
    const row = db.prepare('SELECT COUNT(*) AS n FROM assets').get();
    expect(row.n).toBe(49);
  });

  it('anthem-of-the-seas-new-york-statue-liberty.jpg has correct original_title', () => {
    const row = db
      .prepare('SELECT original_title FROM assets WHERE id = ?')
      .get('anthem-of-the-seas-new-york-statue-liberty.jpg');
    expect(row).toBeTruthy();
    expect(row.original_title).toBe(
      'Anthem of the Seas Sightseeing the Statue of Liberty, New York'
    );
  });

  it('creator [Royal Carribean] normalizes to Royal Caribbean Brand Team', () => {
    // The star-and-icon assets have dc:creator="[Royal Carribean]"
    const rows = db
      .prepare(
        "SELECT id FROM assets WHERE original_creator = '[Royal Carribean]'"
      )
      .all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const asset = db
        .prepare('SELECT enriched_creator_normalized FROM assets WHERE id = ?')
        .get(row.id);
      expect(asset.enriched_creator_normalized).toBe('Royal Caribbean Brand Team');
    }
  });

  it('exactly 7 assets have has_release_placeholder = 1', () => {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM assets WHERE has_release_placeholder = 1')
      .get();
    expect(row.n).toBe(7);
  });

  it('exactly 6 assets have s7_sync_error = 1', () => {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM assets WHERE s7_sync_error = 1')
      .get();
    expect(row.n).toBe(6);
  });

  it('exactly 27 assets have enriched_rights_status = none', () => {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM assets WHERE enriched_rights_status = 'none'")
      .get();
    expect(row.n).toBe(27);
  });

  it('anthem-of-the-seas-new-york-statue-liberty.jpg has enriched_rights_status = owned', () => {
    const row = db
      .prepare('SELECT enriched_rights_status FROM assets WHERE id = ?')
      .get('anthem-of-the-seas-new-york-statue-liberty.jpg');
    expect(row).toBeTruthy();
    expect(row.enriched_rights_status).toBe('owned');
  });

  it('re-running ingestAssets does not insert duplicates (INSERT OR IGNORE)', () => {
    ingestAssets(db, REAL_DATA_DIR);
    const row = db.prepare('SELECT COUNT(*) AS n FROM assets').get();
    expect(row.n).toBe(49);
  });
});

describe('ingestAssets — malformed XML', () => {
  let db;
  let tmpDir;

  beforeAll(() => {
    // Create a temp dir with one valid and one malformed .content.xml
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));

    // Valid asset folder
    const validDir = path.join(tmpDir, 'valid-asset.jpg');
    fs.mkdirSync(validDir);
    fs.writeFileSync(
      path.join(validDir, '.content.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    jcr:primaryType="dam:Asset">
  <jcr:content jcr:primaryType="dam:AssetContent">
    <metadata dc:title="Valid Asset" tiff:ImageWidth="{Long}1920" tiff:ImageLength="{Long}1080" jcr:primaryType="nt:unstructured"/>
  </jcr:content>
</jcr:root>`
    );

    // Malformed asset folder
    const badDir = path.join(tmpDir, 'bad-asset.jpg');
    fs.mkdirSync(badDir);
    fs.writeFileSync(
      path.join(badDir, '.content.xml'),
      '<<<NOT VALID XML>>>'
    );

    db = createTestDb();
  });

  afterAll(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips malformed XML and still ingests the valid file', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const count = ingestAssets(db, tmpDir);
    warnSpy.mockRestore();

    // Only the valid asset should be inserted
    expect(count).toBe(1);
    const row = db.prepare('SELECT COUNT(*) AS n FROM assets').get();
    expect(row.n).toBe(1);
  });
});

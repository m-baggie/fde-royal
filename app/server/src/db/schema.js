/**
 * runMigrations — creates the assets table, FTS5 virtual table, and sync triggers.
 * Safe to call multiple times; all statements use IF NOT EXISTS.
 */
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT,
      thumbnail_path TEXT,
      web_image_path TEXT,
      category TEXT,
      subcategory TEXT,
      subsubcategory TEXT,
      original_title TEXT,
      original_description TEXT,
      original_creator TEXT,
      original_rights_owner TEXT,
      original_dc_rights TEXT,
      original_usage_terms TEXT,
      original_location TEXT,
      original_tags TEXT,
      enriched_title TEXT,
      enriched_description TEXT,
      enriched_tags TEXT,
      enriched_location TEXT,
      enriched_scene TEXT,
      enriched_subjects TEXT,
      enriched_mood TEXT,
      enriched_creator_normalized TEXT,
      enriched_rights_status TEXT,
      enriched_channel TEXT,
      enriched_format TEXT,
      enrichment_source TEXT,
      enrichment_confidence REAL,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      file_format TEXT,
      mime_type TEXT,
      scene7_file TEXT,
      scene7_domain TEXT,
      scene7_status TEXT,
      s7_sync_error INTEGER DEFAULT 0,
      needs_rights_review INTEGER DEFAULT 0,
      has_release_placeholder INTEGER DEFAULT 0,
      variant_group_id TEXT,
      is_primary_variant INTEGER DEFAULT 0,
      dam_last_modified TEXT,
      dam_last_replicated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      tags,
      location,
      creator,
      category,
      subcategory,
      filename,
      content='assets',
      content_rowid='rowid'
    )
  `);

  // AFTER INSERT: index new row
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
      INSERT INTO assets_fts(rowid, id, title, description, tags, location, creator, category, subcategory, filename)
      VALUES (
        new.rowid,
        new.id,
        new.enriched_title,
        new.enriched_description,
        new.enriched_tags,
        new.enriched_location,
        new.enriched_creator_normalized,
        new.category,
        new.subcategory,
        new.filename
      );
    END
  `);

  // AFTER UPDATE: remove old index entry, insert updated entry
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, id, title, description, tags, location, creator, category, subcategory, filename)
      VALUES (
        'delete',
        old.rowid,
        old.id,
        old.enriched_title,
        old.enriched_description,
        old.enriched_tags,
        old.enriched_location,
        old.enriched_creator_normalized,
        old.category,
        old.subcategory,
        old.filename
      );
      INSERT INTO assets_fts(rowid, id, title, description, tags, location, creator, category, subcategory, filename)
      VALUES (
        new.rowid,
        new.id,
        new.enriched_title,
        new.enriched_description,
        new.enriched_tags,
        new.enriched_location,
        new.enriched_creator_normalized,
        new.category,
        new.subcategory,
        new.filename
      );
    END
  `);

  // AFTER DELETE: remove index entry
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, id, title, description, tags, location, creator, category, subcategory, filename)
      VALUES (
        'delete',
        old.rowid,
        old.id,
        old.enriched_title,
        old.enriched_description,
        old.enriched_tags,
        old.enriched_location,
        old.enriched_creator_normalized,
        old.category,
        old.subcategory,
        old.filename
      );
    END
  `);
}

module.exports = { runMigrations };

'use strict';

/**
 * migrateVariants — adds variant grouping columns (if absent) and seeds the
 * four known variant groups in the assets table.
 *
 * Safe to call on every startup:
 *  - ALTER TABLE is only issued when the column is missing (handles existing DBs).
 *  - All UPDATEs are idempotent — they set the same values every time.
 */
function migrateVariants(db) {
  // ── 1. Add columns to existing DBs that pre-date this migration ──────────
  const existingCols = db
    .prepare('PRAGMA table_info(assets)')
    .all()
    .map((c) => c.name);

  if (!existingCols.includes('variant_group_id')) {
    db.exec('ALTER TABLE assets ADD COLUMN variant_group_id TEXT');
  }
  if (!existingCols.includes('is_primary_variant')) {
    db.exec('ALTER TABLE assets ADD COLUMN is_primary_variant INTEGER DEFAULT 0');
  }

  // ── 2. Seed known variant groups ─────────────────────────────────────────
  // grp-galveston: assets whose filename contains 'galveston-texas'
  db.prepare(
    "UPDATE assets SET variant_group_id = 'grp-galveston', is_primary_variant = 0 WHERE id LIKE '%galveston-texas%'"
  ).run();
  db.prepare(
    "UPDATE assets SET is_primary_variant = 1 WHERE id = 'allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg'"
  ).run();

  // grp-star-icon: assets in the star-and-icon subcategory
  db.prepare(
    "UPDATE assets SET variant_group_id = 'grp-star-icon', is_primary_variant = 0 WHERE subcategory = 'star-and-icon'"
  ).run();
  db.prepare(
    "UPDATE assets SET is_primary_variant = 1 WHERE id = '1040x520-2x.jpg'"
  ).run();

  // grp-bankroll: assets whose filename starts with 'Bankroll'
  db.prepare(
    "UPDATE assets SET variant_group_id = 'grp-bankroll', is_primary_variant = 0 WHERE id LIKE 'Bankroll%'"
  ).run();
  db.prepare(
    "UPDATE assets SET is_primary_variant = 1 WHERE id = 'BankrollBlitz_Desktop .jpg'"
  ).run();

  // grp-naples: assets whose filename contains 'naples-italy'
  db.prepare(
    "UPDATE assets SET variant_group_id = 'grp-naples', is_primary_variant = 0 WHERE id LIKE '%naples-italy%'"
  ).run();
  db.prepare(
    "UPDATE assets SET is_primary_variant = 1 WHERE id = 'allure-of-the-seas-naples-italy.jpg'"
  ).run();
}

module.exports = { migrateVariants };

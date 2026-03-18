'use strict';

const { Router } = require('express');
const db = require('../db');

function normalizeChannel(filename, width, height) {
  const f = (filename || '').toLowerCase();
  if (f.includes('hero')) return 'hero';
  if (f.includes('banner')) return 'banner';
  if (f.includes('mobile')) return 'mobile';
  if (f.includes('desktop')) return 'desktop';
  if (f.includes('-bg') || f.includes('_bg') || f.includes('background')) return 'background';
  if (width && height) {
    if (width === height) return 'square';
    if (width / height > 2.5) return 'leaderboard';
    if (width > height) return 'landscape';
    if (height > width) return 'portrait';
  }
  return null;
}

function normalizeLocation(loc) {
  if (!loc) return null;
  if (/^open ocean/i.test(loc)) return 'Open Ocean';
  return loc;
}

const router = Router();

/**
 * GET /api/filters
 * Returns all distinct filter values and quality counts for the UI.
 *
 * Response shape:
 * {
 *   categories:     string[]                              — sorted distinct non-null values
 *   subcategories:  { [category]: string[] }             — sorted subcategory lists per category
 *   locations:      string[]                              — sorted merged distinct locations
 *   channels:       string[]                              — sorted distinct non-null enriched_channel values
 *   scenes:         string[]                              — sorted distinct non-null enriched_scene values
 *   rights_statuses: { value: string, count: number }[]  — for 'owned', 'unclear', 'none'
 *   counts: {
 *     total, missing_title, missing_description,
 *     missing_rights, missing_location,
 *     has_release_placeholder, s7_sync_error
 *   }
 * }
 */
router.get('/', (req, res) => {
  try {
    // categories
    const categoryRows = db
      .prepare(
        `SELECT DISTINCT category FROM assets
         WHERE category IS NOT NULL
         ORDER BY category ASC`
      )
      .all();
    const categories = categoryRows.map((r) => r.category);

    // subcategories — one query; group in JS
    const subcategoryRows = db
      .prepare(
        `SELECT DISTINCT category, subcategory FROM assets
         WHERE category IS NOT NULL AND subcategory IS NOT NULL
         ORDER BY category ASC, subcategory ASC`
      )
      .all();
    const subcategories = {};
    for (const { category, subcategory } of subcategoryRows) {
      if (!subcategories[category]) subcategories[category] = [];
      subcategories[category].push(subcategory);
    }

    // channels — normalize from filename keywords, fall back to AI value
    const channelAssets = db.prepare('SELECT filename, width, height FROM assets').all();
    const channels = [...new Set(
      channelAssets.map((a) => normalizeChannel(a.filename, a.width, a.height)).filter(Boolean)
    )].sort();

    // scenes — distinct enriched_scene values
    const sceneRows = db
      .prepare(
        `SELECT DISTINCT enriched_scene AS scene FROM assets
         WHERE enriched_scene IS NOT NULL
         ORDER BY enriched_scene ASC`
      )
      .all();
    const scenes = sceneRows.map((r) => r.scene);

    // destination_regions — distinct enriched_destination_region values
    const destRegionRows = db
      .prepare(
        `SELECT DISTINCT enriched_destination_region AS destination_region FROM assets
         WHERE enriched_destination_region IS NOT NULL
         ORDER BY enriched_destination_region ASC`
      )
      .all();
    const destination_regions = destRegionRows.map((r) => r.destination_region);

    // content_types — distinct enriched_content_type values
    const contentTypeRows = db
      .prepare(
        `SELECT DISTINCT enriched_content_type AS content_type FROM assets
         WHERE enriched_content_type IS NOT NULL
         ORDER BY enriched_content_type ASC`
      )
      .all();
    const content_types = contentTypeRows.map((r) => r.content_type);

    // locations — merge original_location and enriched_location, deduplicate
    const locRows = db
      .prepare(
        `SELECT original_location AS loc FROM assets WHERE original_location IS NOT NULL
         UNION
         SELECT enriched_location AS loc FROM assets WHERE enriched_location IS NOT NULL`
      )
      .all();
    const locations = [...new Set(locRows.map((r) => normalizeLocation(r.loc)).filter(Boolean))].sort();

    // rights_statuses
    const rightsRows = db
      .prepare(
        `SELECT enriched_rights_status AS value, COUNT(*) AS count
         FROM assets
         WHERE enriched_rights_status IN ('owned', 'unclear', 'none')
         GROUP BY enriched_rights_status`
      )
      .all();
    // Ensure all three appear even if count is 0
    const rightsMap = { owned: 0, unclear: 0, none: 0 };
    for (const { value, count } of rightsRows) {
      rightsMap[value] = count;
    }
    const rights_statuses = Object.entries(rightsMap).map(([value, count]) => ({
      value,
      count,
    }));

    // counts
    const total = db.prepare('SELECT COUNT(*) AS n FROM assets').get().n;

    const missing_title = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE (original_title IS NULL OR original_title = '')
           AND (enriched_title IS NULL OR enriched_title = '')`
      )
      .get().n;

    const missing_description = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE (original_description IS NULL OR original_description = '')
           AND (enriched_description IS NULL OR enriched_description = '')`
      )
      .get().n;

    const missing_rights = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE enriched_rights_status = 'none'`
      )
      .get().n;

    const missing_location = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE (original_location IS NULL OR original_location = '')
           AND (enriched_location IS NULL OR enriched_location = '')`
      )
      .get().n;

    const has_release_placeholder = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE has_release_placeholder = 1`
      )
      .get().n;

    const s7_sync_error = db
      .prepare(
        `SELECT COUNT(*) AS n FROM assets
         WHERE s7_sync_error = 1`
      )
      .get().n;

    res.json({
      categories,
      subcategories,
      locations,
      channels,
      scenes,
      destination_regions,
      content_types,
      rights_statuses,
      counts: {
        total,
        missing_title,
        missing_description,
        missing_rights,
        missing_location,
        has_release_placeholder,
        s7_sync_error,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load filters', detail: err.message });
  }
});

module.exports = router;

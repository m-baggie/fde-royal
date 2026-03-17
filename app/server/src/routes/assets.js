'use strict';

const { Router } = require('express');
const db = require('../db');
const { searchAssets } = require('../services/search');
const { enrichAsset } = require('../services/enrich');

const router = Router();

/**
 * GET /api/assets
 * Search and filter assets. Supported query params:
 *   q, category, subcategory, rights_status, location,
 *   has_title, has_rights, has_release_placeholder,
 *   limit (default 100, max 200), offset (default 0)
 */
router.get('/', (req, res) => {
  try {
    const result = searchAssets(db, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

/**
 * GET /api/assets/:id
 * Returns the full asset row plus computed fields:
 *   cdn_url, quality_issues, display_title, display_description, display_tags
 */
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  // cdn_url
  const cdn_url =
    row.scene7_domain && row.scene7_file
      ? `${row.scene7_domain}/is/image/${row.scene7_file}`
      : null;

  // quality_issues
  const quality_issues = [];
  const isEmpty = (v) => v === null || v === undefined || v === '';
  if (isEmpty(row.original_title) && isEmpty(row.enriched_title)) {
    quality_issues.push('missing_title');
  }
  if (isEmpty(row.original_description) && isEmpty(row.enriched_description)) {
    quality_issues.push('missing_description');
  }
  if (row.enriched_rights_status === 'none') {
    quality_issues.push('missing_rights');
  }
  if (isEmpty(row.original_location) && isEmpty(row.enriched_location)) {
    quality_issues.push('missing_location');
  }
  if (
    !isEmpty(row.original_title) &&
    !isEmpty(row.original_description) &&
    row.original_title === row.original_description
  ) {
    quality_issues.push('title_equals_description');
  }
  if (row.s7_sync_error === 1) {
    quality_issues.push('s7_sync_error');
  }
  if (row.has_release_placeholder === 1) {
    quality_issues.push('release_placeholder');
  }

  // display fields
  const filenameBase = row.filename ? row.filename.replace(/\.[^.]+$/, '') : null;
  const display_title = row.enriched_title || row.original_title || filenameBase;
  const display_description = row.enriched_description || row.original_description || null;

  function tryParseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  }
  const enrichedTagsArr = tryParseJson(row.enriched_tags) || [];
  const originalTagsArr = tryParseJson(row.original_tags) || [];
  const display_tags = [...new Set([...enrichedTagsArr, ...originalTagsArr])];

  res.json({
    ...row,
    cdn_url,
    quality_issues,
    display_title,
    display_description,
    display_tags,
  });
});

/**
 * POST /api/assets/:id/enrich
 * Enriches the asset with AI-generated metadata via OpenAI Vision.
 * Requires OPENAI_API_KEY to be configured; returns 503 otherwise.
 */
router.post('/:id/enrich', async (req, res) => {
  const openai = req.app.locals.openai;
  if (!openai) {
    return res.status(503).json({ error: 'AI enrichment unavailable — OPENAI_API_KEY not configured' });
  }

  try {
    const updated = await enrichAsset(db, req.params.id, openai);
    if (!updated) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(updated);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    res.status(502).json({ error: 'Enrichment failed', detail: err.message });
  }
});

module.exports = router;

'use strict';

/**
 * searchAssets — full-text + structured filter search over the assets table.
 *
 * Strategy:
 *  - If `q` is provided: try FTS5 MATCH first (ranked by relevance).
 *    Fall back to LIKE %q% on key text columns if FTS returns 0 results
 *    (handles edge cases where FTS5 query syntax errors or index misses).
 *  - All other params (category, subcategory, rights_status, location,
 *    has_title, has_rights, has_release_placeholder) become WHERE clauses.
 *  - Returns { total, assets } where total is the count WITHOUT limit/offset.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} params  — query params (all values are strings from req.query)
 * @returns {{ total: number, assets: object[] }}
 */
function searchAssets(db, params) {
  const {
    q,
    category,
    subcategory,
    rights_status,
    location,
    channel,
    scene,
    destination_region,
    content_type,
    has_title,
    has_rights,
    has_release_placeholder,
    show_all_variants,
    limit: rawLimit,
    offset: rawOffset,
  } = params;

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 100, 1), 200);
  const offset = Math.max(parseInt(rawOffset, 10) || 0, 0);

  // Structured filter conditions (applied in both FTS and non-FTS paths)
  const conditions = [];
  const condArgs = [];

  if (category !== undefined && category !== null && category !== '') {
    conditions.push('a.category = ?');
    condArgs.push(category);
  }
  if (subcategory !== undefined && subcategory !== null && subcategory !== '') {
    conditions.push('a.subcategory = ?');
    condArgs.push(subcategory);
  }
  if (rights_status !== undefined && rights_status !== null && rights_status !== '') {
    conditions.push('a.enriched_rights_status = ?');
    condArgs.push(rights_status);
  }
  if (location !== undefined && location !== null && location !== '') {
    conditions.push('(a.enriched_location = ? OR a.original_location = ?)');
    condArgs.push(location, location);
  }
  if (channel !== undefined && channel !== null && channel !== '') {
    conditions.push('a.enriched_channel = ?');
    condArgs.push(channel);
  }
  if (scene !== undefined && scene !== null && scene !== '') {
    conditions.push('a.enriched_scene = ?');
    condArgs.push(scene);
  }
  if (destination_region !== undefined && destination_region !== null && destination_region !== '') {
    conditions.push('a.enriched_destination_region = ?');
    condArgs.push(destination_region);
  }
  if (content_type !== undefined && content_type !== null && content_type !== '') {
    conditions.push('a.enriched_content_type = ?');
    condArgs.push(content_type);
  }
  if (has_title === 'true') {
    conditions.push(
      "((a.original_title IS NOT NULL AND a.original_title != '') OR (a.enriched_title IS NOT NULL AND a.enriched_title != ''))"
    );
  }
  if (has_rights === 'true') {
    conditions.push("(a.enriched_rights_status IS NOT NULL AND a.enriched_rights_status != 'none')");
  }
  if (has_release_placeholder === 'true') {
    conditions.push('a.has_release_placeholder = 1');
  }
  if (!show_all_variants) {
    // Default: grouped mode — show one card per variant group plus all ungrouped assets
    conditions.push('(a.is_primary_variant = 1 OR a.variant_group_id IS NULL)');
  }

  const SELECT_FIELDS = `
    a.id, a.filename, a.category, a.subcategory,
    a.thumbnail_path, a.web_image_path,
    a.original_title, a.enriched_title,
    a.original_description, a.enriched_description,
    a.original_tags, a.enriched_tags,
    a.enriched_rights_status, a.enrichment_source,
    a.enriched_channel, a.enriched_scene,
    a.enriched_destination_region, a.enriched_content_type,
    a.width, a.height,
    a.scene7_file, a.scene7_domain,
    a.s7_sync_error, a.needs_rights_review, a.has_release_placeholder,
    CASE WHEN a.variant_group_id IS NULL THEN 1
         ELSE (SELECT COUNT(*) FROM assets v WHERE v.variant_group_id = a.variant_group_id)
    END AS variant_count
  `;

  if (q) {
    // --- FTS path ---
    const ftsWhere = conditions.length ? 'AND ' + conditions.join(' AND ') : '';
    const ftsSql = `
      SELECT ${SELECT_FIELDS}
      FROM assets a
      JOIN assets_fts ON a.rowid = assets_fts.rowid
      WHERE assets_fts MATCH ?
      ${ftsWhere}
      ORDER BY assets_fts.rank
      LIMIT ? OFFSET ?
    `;
    const ftsCountSql = `
      SELECT COUNT(*) AS total
      FROM assets a
      JOIN assets_fts ON a.rowid = assets_fts.rowid
      WHERE assets_fts MATCH ?
      ${ftsWhere}
    `;

    try {
      const ftsArgs = [q, ...condArgs];
      const total = db.prepare(ftsCountSql).get(...ftsArgs).total;
      if (total > 0) {
        const rows = db.prepare(ftsSql).all(...ftsArgs, limit, offset);
        return { total, assets: formatAssets(rows) };
      }
      // FTS returned 0 — fall through to LIKE fallback below
    } catch (_err) {
      // FTS query syntax error or similar — fall through to LIKE fallback
    }

    // --- LIKE fallback ---
    // Split on whitespace so "allure sunset" matches assets containing both words
    const terms = q.trim().split(/\s+/).filter(Boolean);
    const likeConditions = terms.map(() =>
      '(a.original_title LIKE ? OR a.enriched_title LIKE ? OR a.original_description LIKE ? OR a.enriched_description LIKE ? OR a.filename LIKE ?)'
    );
    const likeArgs = [
      ...terms.flatMap((t) => { const v = `%${t}%`; return [v, v, v, v, v]; }),
      ...condArgs,
    ];
    const allLikeConds = [...likeConditions, ...conditions];
    const likeWhere = 'WHERE ' + allLikeConds.join(' AND ');

    const likeSql = `SELECT ${SELECT_FIELDS} FROM assets a ${likeWhere} LIMIT ? OFFSET ?`;
    const likeCountSql = `SELECT COUNT(*) AS total FROM assets a ${likeWhere}`;

    const total = db.prepare(likeCountSql).get(...likeArgs).total;
    const rows = db.prepare(likeSql).all(...likeArgs, limit, offset);
    return { total, assets: formatAssets(rows) };
  }

  // --- No q: structured filters only ---
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT ${SELECT_FIELDS} FROM assets a ${where} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS total FROM assets a ${where}`;

  const total = db.prepare(countSql).get(...condArgs).total;
  const rows = db.prepare(sql).all(...condArgs, limit, offset);
  return { total, assets: formatAssets(rows) };
}

/**
 * Compute display fields and return a clean asset object.
 * - display_title:       enriched_title ?? original_title ?? filename (sans extension)
 * - display_description: enriched_description ?? original_description ?? null
 * - display_tags:        merged + deduplicated array from enriched_tags + original_tags (JSON strings)
 */
function formatAssets(rows) {
  return rows.map((row) => {
    const filenameBase = row.filename ? row.filename.replace(/\.[^.]+$/, '') : null;
    const display_title = row.enriched_title || row.original_title || filenameBase;
    const display_description = row.enriched_description || row.original_description || null;

    const enrichedTagsArr = tryParseJson(row.enriched_tags) || [];
    const originalTagsArr = tryParseJson(row.original_tags) || [];
    const display_tags = [...new Set([...enrichedTagsArr, ...originalTagsArr])];

    return {
      id: row.id,
      filename: row.filename,
      category: row.category,
      subcategory: row.subcategory,
      display_title,
      display_description,
      display_tags,
      thumbnail_path: row.thumbnail_path,
      web_image_path: row.web_image_path,
      enriched_rights_status: row.enriched_rights_status,
      enrichment_source: row.enrichment_source,
      enriched_channel: row.enriched_channel || normalizeChannel(row.filename, row.width, row.height),
      enriched_scene: row.enriched_scene,
      enriched_destination_region: row.enriched_destination_region,
      enriched_content_type: row.enriched_content_type,
      width: row.width,
      height: row.height,
      scene7_file: row.scene7_file,
      scene7_domain: row.scene7_domain,
      s7_sync_error: row.s7_sync_error,
      needs_rights_review: row.needs_rights_review,
      has_release_placeholder: row.has_release_placeholder,
      variant_count: row.variant_count != null ? row.variant_count : 1,
    };
  });
}

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

function tryParseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

module.exports = { searchAssets };

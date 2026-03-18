'use strict';

const fs = require('fs');
const path = require('path');

/**
 * ENRICH_PROMPT — shared RC taxonomy-aware prompt used by both single-asset
 * (enrichAsset) and bulk (enrich-all.js) enrichment pipelines.
 *
 * Includes:
 * - Known RC ship names so the model can identify them correctly
 * - destination_region controlled vocabulary (maps to enriched_destination_region)
 * - content_type controlled vocabulary (maps to enriched_content_type)
 * - RC marketing tone guidance (aspirational, warmly adventurous)
 * - No channel_hint — channel is derived from filename, not AI
 */
const ENRICH_PROMPT =
  'You are a digital asset metadata specialist for Royal Caribbean Group. ' +
  'Analyze this image and respond with ONLY valid JSON (no markdown, no code fences):\n' +
  '{\n' +
  '  "title": string (concise, 5-10 words, Royal Caribbean brand voice — aspirational and warmly adventurous),\n' +
  '  "description": string (2-3 sentences, Royal Caribbean marketing tone — evoke excitement, discovery, and luxury),\n' +
  '  "tags": string[] (6-12 specific descriptive tags covering subject, setting, mood, activity),\n' +
  '  "location": string|null (specific place name — city, country, or shipboard venue; null if unknown),\n' +
  '  "destination_region": string|null (pick exactly ONE from this list or null: ' +
  '"Caribbean", "Alaska", "Europe", "Asia", "Australia-Pacific", "Arabian-Gulf", ' +
  '"Bahamas", "Mexico", "US-Coastal", "Transatlantic", "World-Cruise"),\n' +
  '  "content_type": string|null (pick exactly ONE from this list or null: ' +
  '"ship-exterior", "ship-interior", "destination-landscape", "destination-cultural", ' +
  '"onboard-activity", "dining", "entertainment", "suite-cabin", ' +
  '"family-moments", "couple-moments", "adventure", "promotion-graphic"),\n' +
  '  "scene": string (one sentence describing the visual scene),\n' +
  '  "subjects": string[] (main subjects visible — e.g. "cruise ship", "family", "beach"),\n' +
  '  "mood": string (emotional tone in 1-3 words — e.g. "adventurous", "romantic", "joyful"),\n' +
  '  "confidence": number (0-1, your confidence in the enrichment quality)\n' +
  '}\n\n' +
  'Royal Caribbean fleet reference (use for title/description/tags when a ship is visible): ' +
  'Allure of the Seas, Oasis of the Seas, Symphony of the Seas, Wonder of the Seas, ' +
  'Harmony of the Seas, Icon of the Seas, Utopia of the Seas, Anthem of the Seas, ' +
  'Quantum of the Seas, Ovation of the Seas, Spectrum of the Seas, Odyssey of the Seas, ' +
  'Navigator of the Seas, Mariner of the Seas, Explorer of the Seas, Voyager of the Seas, ' +
  'Adventure of the Seas, Freedom of the Seas, Liberty of the Seas, Independence of the Seas, ' +
  'Vision of the Seas, Enchantment of the Seas, Grandeur of the Seas, Radiance of the Seas, ' +
  'Brilliance of the Seas, Jewel of the Seas, Serenade of the Seas.';

/**
 * enrichAsset — calls Anthropic Vision on the asset's image file and writes
 * the AI-generated metadata back to the assets table.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} id - asset UUID
 * @param {import('@anthropic-ai/sdk').Anthropic} anthropicClient
 * @returns {object} updated full asset row
 */
async function enrichAsset(db, id, anthropicClient) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);

  if (!asset) {
    const err = new Error('Asset not found');
    err.status = 404;
    throw err;
  }

  if (!asset.filepath) {
    const err = new Error('No image file available for enrichment');
    err.status = 400;
    throw err;
  }

  // filepath is stored relative to app root (e.g. "uploads/<uuid>-name.jpg")
  // server/src/services/ → ../../.. → app root
  const appRoot = path.join(__dirname, '../../../');
  const absPath = path.join(appRoot, asset.filepath);

  if (!fs.existsSync(absPath)) {
    const err = new Error('Image file not found on disk');
    err.status = 404;
    throw err;
  }

  const imageBuffer = fs.readFileSync(absPath);
  const base64Data = imageBuffer.toString('base64');
  const mimeType = asset.mime_type || 'image/jpeg';

  const response = await anthropicClient.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Data },
          },
          {
            type: 'text',
            text: ENRICH_PROMPT,
          },
        ],
      },
    ],
  });

  const rawContent = response.content[0].text;
  const parsed = JSON.parse(rawContent);
  persistEnrichment(db, id, asset, parsed);

  return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
}

/**
 * persistEnrichment — writes parsed AI enrichment fields to the DB.
 * Handles destination_region and content_type alongside existing fields.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} id
 * @param {object} asset - original asset row (for FTS sync fields)
 * @param {object} parsed - parsed AI response
 */
function persistEnrichment(db, id, asset, parsed) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE assets SET
      enriched_title = ?,
      enriched_description = ?,
      enriched_tags = ?,
      enriched_location = ?,
      enriched_scene = ?,
      enriched_subjects = ?,
      enriched_mood = ?,
      enriched_destination_region = ?,
      enriched_content_type = ?,
      enrichment_source = 'ai-vision',
      enrichment_confidence = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    parsed.title || null,
    parsed.description || null,
    JSON.stringify(parsed.tags || []),
    parsed.location || null,
    parsed.scene || null,
    JSON.stringify(parsed.subjects || []),
    parsed.mood || null,
    parsed.destination_region || null,
    parsed.content_type || null,
    parsed.confidence != null ? parsed.confidence : null,
    now,
    id,
  );
}

module.exports = { enrichAsset, ENRICH_PROMPT };

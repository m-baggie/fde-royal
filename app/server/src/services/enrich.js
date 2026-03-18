'use strict';

const fs = require('fs');
const path = require('path');

const ENRICH_PROMPT =
  'Analyze this image and respond with ONLY valid JSON, no markdown: ' +
  '{ "title": string, "description": string, "tags": string[], "location": string|null, ' +
  '"scene": string, "subjects": string[], "mood": string, "channel_hint": string, "confidence": number 0-1 }';

/**
 * enrichAsset — calls Claude Vision on the asset's image file and writes
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
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: ENRICH_PROMPT,
          },
        ],
      },
    ],
  });

  const rawContent = response.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(rawContent);
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
      enriched_channel = ?,
      enrichment_source = 'ai-vision',
      enrichment_confidence = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    parsed.title,
    parsed.description,
    JSON.stringify(parsed.tags),
    parsed.location,
    parsed.scene,
    JSON.stringify(parsed.subjects),
    parsed.mood,
    parsed.channel_hint,
    parsed.confidence,
    now,
    id,
  );

  return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
}

module.exports = { enrichAsset };

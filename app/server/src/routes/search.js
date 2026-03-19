'use strict';

const { Router } = require('express');
const db = require('../db');
const { searchAssets } = require('../services/search');

const router = Router();

/**
 * RC-specific extraction prompt.
 * Instructs Claude Haiku to parse a natural-language prompt into structured
 * search parameters for the Royal Caribbean DAM library.
 * Returns a JSON object — no markdown, no prose outside the object.
 */
const EXTRACTION_PROMPT =
  'You are a search assistant for the Royal Caribbean Group digital asset management (DAM) library. ' +
  'Parse the user prompt into structured search parameters for the asset library. ' +
  'The library contains cruise ship photography, destination images, and marketing materials.\n\n' +
  'Return ONLY a valid JSON object (no markdown, no extra text) with these fields:\n' +
  '  "search_terms": string[] — 3-8 relevant keywords/phrases for full-text search\n' +
  '  "content_type": string|null — one of: "ship","destination","promotion","casino","activity", or null\n' +
  '  "mood": string|null — e.g. "sunset","aerial","action","lifestyle", or null\n' +
  '  "location": string|null — specific ship name or port name, or null\n' +
  '  "destination_region": string|null — e.g. "Caribbean","Europe","Asia","Arabian Gulf", or null\n' +
  '  "channel": string|null — one of: "hero","banner","mobile","desktop","square","landscape","portrait", or null\n' +
  '  "explanation": string — one sentence explaining what assets this query will return\n\n' +
  'User prompt: ';

/**
 * POST /api/search/prompt
 *
 * Accepts: { prompt: string }
 * Returns: { total, assets, explanation }
 *
 * Uses Claude Haiku to extract structured search params from the prompt,
 * then calls searchAssets(). Falls back to plain-text search if Claude is
 * unavailable or returns unparseable JSON.
 */
router.post('/prompt', async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
  }

  const anthropic = req.app.locals.anthropic;

  // No API key configured — fall back to plain search
  if (!anthropic) {
    const result = searchAssets(db, { q: prompt });
    return res.json({ ...result, explanation: null });
  }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}"${prompt}"` }],
    });

    const text = msg.content[0].text;
    const parsed = JSON.parse(text);

    // Build searchAssets params from extracted fields
    const searchParams = {};

    if (Array.isArray(parsed.search_terms) && parsed.search_terms.length > 0) {
      searchParams.q = parsed.search_terms.join(' OR ');
    } else {
      searchParams.q = prompt;
    }

    if (parsed.content_type) searchParams.content_type = parsed.content_type;
    if (parsed.mood) searchParams.scene = parsed.mood;
    if (parsed.location) searchParams.location = parsed.location;
    if (parsed.destination_region) searchParams.destination_region = parsed.destination_region;
    if (parsed.channel) searchParams.channel = parsed.channel;

    const result = searchAssets(db, searchParams);
    const explanation = typeof parsed.explanation === 'string' ? parsed.explanation : null;

    return res.json({ ...result, explanation });
  } catch (_err) {
    // Claude failure or unparseable JSON — fall back to plain search
    const result = searchAssets(db, { q: prompt });
    return res.json({ ...result, explanation: null });
  }
});

module.exports = router;

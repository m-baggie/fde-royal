'use strict';

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');
const { ENRICH_PROMPT } = require('../src/services/enrich');

const ENRICH_DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || '500', 10);

// DATA_DIR: default to ../Data/royal relative to server/ (sibling of app/)
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.cwd(), process.env.DATA_DIR)
  : path.resolve(__dirname, '../..', '../Data/royal');

const db = new Database(path.resolve(__dirname, '../../dam.sqlite'));
const anthropicClient = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Fetch a URL and return the body as a Buffer
// ---------------------------------------------------------------------------
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Resolve image base64 for an asset row
// Priority: (1) Scene7 CDN, (2) thumbnail file from DATA_DIR
// Returns null if neither source is available.
// ---------------------------------------------------------------------------
async function getImageBase64(asset) {
  // Priority 1: full web rendition from local DATA_DIR (1280px, best quality)
  if (asset.web_image_path) {
    const absPath = path.resolve(DATA_DIR, asset.web_image_path);
    if (fs.existsSync(absPath)) {
      return fs.readFileSync(absPath).toString('base64');
    }
  }

  // Priority 2: thumbnail rendition from local DATA_DIR
  if (asset.thumbnail_path) {
    const absPath = path.resolve(DATA_DIR, asset.thumbnail_path);
    if (fs.existsSync(absPath)) {
      return fs.readFileSync(absPath).toString('base64');
    }
  }

  // Priority 3: Scene7 CDN fallback (for assets without local renditions)
  if (asset.scene7_file && asset.scene7_domain) {
    const cdnUrl =
      asset.scene7_domain.replace(/\/+$/, '') + '/is/image/' + asset.scene7_file;
    try {
      const buf = await fetchBuffer(cdnUrl);
      return buf.toString('base64');
    } catch (_) {
      // no source available
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Call Anthropic Vision
// ---------------------------------------------------------------------------
async function callAnthropic(base64, mimeType, prompt) {
  const response = await anthropicClient.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  const raw = response.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Write enriched data to DB and sync FTS5
// ---------------------------------------------------------------------------
function persistEnrichment(asset, parsed) {
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
    asset.id,
  );

  // FTS5 sync is handled automatically by the assets_au trigger on UPDATE
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const reseed = process.argv.includes('--reseed');

  if (reseed) {
    const result = db.prepare(`
      UPDATE assets SET
        enriched_title = NULL,
        enriched_description = NULL,
        enriched_tags = NULL,
        enriched_location = NULL,
        enriched_scene = NULL,
        enriched_subjects = NULL,
        enriched_mood = NULL,
        enriched_destination_region = NULL,
        enriched_content_type = NULL,
        enrichment_source = NULL,
        enrichment_confidence = NULL
      WHERE enrichment_source IS NOT NULL AND enrichment_source != 'user-edited'
    `).run();
    console.log(`Reseed mode: wiped ${result.changes} assets`);
  }

  const assets = db.prepare('SELECT * FROM assets WHERE enrichment_source IS NULL').all();

  if (assets.length === 0) {
    console.log('All assets already enriched. Nothing to do.');
    process.exit(0);
  }

  const total = assets.length;
  let enriched = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const prefix = `[${i + 1}/${total}] Enriching ${asset.filename}...`;

    // Resolve image source
    const base64 = await getImageBase64(asset);
    if (!base64) {
      console.log(`SKIP ${asset.filename}: no image source`);
      process.stdout.write(prefix + ' skipped\n');
      skipped++;
      if (i < assets.length - 1) await sleep(ENRICH_DELAY_MS);
      continue;
    }

    const mimeType = asset.mime_type || 'image/jpeg';

    // Attempt full prompt, retry with simplified on error
    let parsed = null;
    try {
      parsed = await callAnthropic(base64, mimeType, ENRICH_PROMPT);
    } catch (_firstErr) {
      process.stdout.write(prefix + ' retrying...\n');
      try {
        parsed = await callAnthropic(base64, mimeType, ENRICH_PROMPT);
      } catch (secondErr) {
        console.log(`FAILED ${asset.filename}: ${secondErr.message}`);
        process.stdout.write(prefix + ' failed\n');
        failed++;
        if (i < assets.length - 1) await sleep(ENRICH_DELAY_MS);
        continue;
      }
    }

    // Persist to DB
    try {
      persistEnrichment(asset, parsed);
    } catch (dbErr) {
      console.log(`FAILED ${asset.filename}: ${dbErr.message}`);
      process.stdout.write(prefix + ' failed\n');
      failed++;
      if (i < assets.length - 1) await sleep(ENRICH_DELAY_MS);
      continue;
    }

    process.stdout.write(prefix + ' done\n');
    enriched++;

    if (i < assets.length - 1) await sleep(ENRICH_DELAY_MS);
  }

  console.log(`Enriched: ${enriched} | Failed: ${failed} | Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

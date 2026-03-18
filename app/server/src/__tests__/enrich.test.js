'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../index');
const db = require('../db');
const { enrichAsset } = require('../services/enrich');

// ---------------------------------------------------------------------------
// Minimal valid JPEG buffer used for uploads
// ---------------------------------------------------------------------------
const minimalJpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// ---------------------------------------------------------------------------
// Mock Anthropic response factory
// Returns a client shaped like the @anthropic-ai/sdk Anthropic instance.
// ---------------------------------------------------------------------------
const mockAiPayload = {
  title: 'Sunset Cruise',
  description: 'A ship sailing into a golden sunset',
  tags: ['ship', 'sunset', 'ocean'],
  location: 'Caribbean Sea',
  destination_region: 'Caribbean',
  content_type: 'ship-exterior',
  scene: 'outdoor',
  subjects: ['cruise ship', 'water'],
  mood: 'serene',
  confidence: 0.92,
};

function makeMockAnthropic(payload = mockAiPayload) {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, '../../../uploads');

function insertTestAsset(overrides = {}) {
  const id = `test-enrich-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaults = {
    id,
    filename: 'test.jpg',
    filepath: null,
    mime_type: 'image/jpeg',
    file_size: 100,
    category: 'test',
    enrichment_source: 'pending',
  };
  const row = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO assets (id, filename, filepath, mime_type, file_size, category, enrichment_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.filename, row.filepath, row.mime_type, row.file_size, row.category, row.enrichment_source, new Date().toISOString());
  return id;
}

// Track resources for cleanup
const insertedIds = [];
const writtenFiles = [];

afterAll(() => {
  const del = db.prepare('DELETE FROM assets WHERE id = ?');
  for (const id of insertedIds) del.run(id);
  for (const f of writtenFiles) {
    try { fs.unlinkSync(f); } catch (_) { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// enrichAsset unit tests (direct service calls, no HTTP)
// ---------------------------------------------------------------------------
describe('enrichAsset service', () => {
  it('maps all response fields correctly to DB columns', async () => {
    const id = insertTestAsset({ filepath: null });
    insertedIds.push(id);

    const fname = `${id}-test.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const mockClient = makeMockAnthropic();
    const updated = await enrichAsset(db, id, mockClient);

    expect(updated.enriched_title).toBe(mockAiPayload.title);
    expect(updated.enriched_description).toBe(mockAiPayload.description);
    expect(JSON.parse(updated.enriched_tags)).toEqual(mockAiPayload.tags);
    expect(updated.enriched_location).toBe(mockAiPayload.location);
    expect(updated.enriched_scene).toBe(mockAiPayload.scene);
    expect(JSON.parse(updated.enriched_subjects)).toEqual(mockAiPayload.subjects);
    expect(updated.enriched_mood).toBe(mockAiPayload.mood);
    expect(updated.enriched_destination_region).toBe(mockAiPayload.destination_region);
    expect(updated.enriched_content_type).toBe(mockAiPayload.content_type);
    expect(updated.enrichment_source).toBe('ai-vision');
    expect(updated.enrichment_confidence).toBeCloseTo(mockAiPayload.confidence);
  });

  it('after enrich, asset has non-null enriched_title in DB', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-titled.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const mockClient = makeMockAnthropic();
    await enrichAsset(db, id, mockClient);

    const row = db.prepare('SELECT enriched_title FROM assets WHERE id = ?').get(id);
    expect(row.enriched_title).not.toBeNull();
    expect(row.enriched_title).toBe(mockAiPayload.title);
  });

  it('after enrich, FTS search on enriched_title returns the asset', async () => {
    const uniqueTitle = `UniqueShipTitle${Date.now()}`;
    const payload = { ...mockAiPayload, title: uniqueTitle };

    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-fts.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const mockClient = makeMockAnthropic(payload);
    await enrichAsset(db, id, mockClient);

    const results = db.prepare(`
      SELECT a.id FROM assets a
      JOIN assets_fts fts ON a.rowid = fts.rowid
      WHERE assets_fts MATCH ?
    `).all(uniqueTitle);

    expect(results.some((r) => r.id === id)).toBe(true);
  });

  it('writes destination_region and content_type to DB', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-region.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const mockClient = makeMockAnthropic({
      ...mockAiPayload,
      destination_region: 'Europe',
      content_type: 'destination-landscape',
    });
    await enrichAsset(db, id, mockClient);

    const row = db.prepare(
      'SELECT enriched_destination_region, enriched_content_type FROM assets WHERE id = ?'
    ).get(id);
    expect(row.enriched_destination_region).toBe('Europe');
    expect(row.enriched_content_type).toBe('destination-landscape');
  });
});

// ---------------------------------------------------------------------------
// Negative cases via enrichAsset service
// ---------------------------------------------------------------------------
describe('enrichAsset — negative cases', () => {
  it('throws 400 when asset has no filepath', async () => {
    const id = insertTestAsset({ filepath: null });
    insertedIds.push(id);

    const mockClient = makeMockAnthropic();
    await expect(enrichAsset(db, id, mockClient)).rejects.toMatchObject({
      message: 'No image file available for enrichment',
      status: 400,
    });
  });

  it('throws 404 when filepath does not exist on disk', async () => {
    const id = insertTestAsset({ filepath: 'uploads/nonexistent-file.jpg' });
    insertedIds.push(id);

    const mockClient = makeMockAnthropic();
    await expect(enrichAsset(db, id, mockClient)).rejects.toMatchObject({
      message: 'Image file not found on disk',
      status: 404,
    });
  });

  it('throws and leaves asset unchanged when Anthropic throws', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-ai-err.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const errorClient = {
      messages: { create: jest.fn().mockRejectedValue(new Error('API rate limit')) },
    };

    await expect(enrichAsset(db, id, errorClient)).rejects.toThrow('API rate limit');

    const row = db.prepare('SELECT enriched_title, enrichment_source FROM assets WHERE id = ?').get(id);
    expect(row.enriched_title).toBeNull();
    expect(row.enrichment_source).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// HTTP endpoint tests — POST /api/assets/:id/enrich
// ---------------------------------------------------------------------------
describe('POST /api/assets/:id/enrich', () => {
  beforeEach(() => {
    app.locals.anthropic = makeMockAnthropic();
  });

  afterEach(() => {
    delete app.locals.anthropic;
  });

  it('returns 503 when ANTHROPIC_API_KEY not configured', async () => {
    delete app.locals.anthropic;
    const res = await request(app).post('/api/assets/nonexistent/enrich');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'AI enrichment unavailable — ANTHROPIC_API_KEY not configured' });
  });

  it('returns 400 when asset has no filepath', async () => {
    const id = insertTestAsset({ filepath: null });
    insertedIds.push(id);

    const res = await request(app).post(`/api/assets/${encodeURIComponent(id)}/enrich`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No image file available for enrichment' });
  });

  it('returns 404 when filepath does not exist on disk', async () => {
    const id = insertTestAsset({ filepath: 'uploads/missing.jpg' });
    insertedIds.push(id);

    const res = await request(app).post(`/api/assets/${encodeURIComponent(id)}/enrich`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Image file not found on disk' });
  });

  it('returns 502 when Anthropic throws, asset row unchanged', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-502.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    app.locals.anthropic = {
      messages: { create: jest.fn().mockRejectedValue(new Error('Network error')) },
    };

    const res = await request(app).post(`/api/assets/${encodeURIComponent(id)}/enrich`);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: 'Enrichment failed', detail: 'Network error' });

    const row = db.prepare('SELECT enriched_title FROM assets WHERE id = ?').get(id);
    expect(row.enriched_title).toBeNull();
  });

  it('returns 200 with updated asset when enrichment succeeds', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-success.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    const res = await request(app).post(`/api/assets/${encodeURIComponent(id)}/enrich`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.enriched_title).toBe(mockAiPayload.title);
    expect(res.body.enrichment_source).toBe('ai-vision');
  });

  it('returns 200 with enriched_content_type populated (US-002)', async () => {
    const id = insertTestAsset();
    insertedIds.push(id);

    const fname = `${id}-content-type.jpg`;
    const fpath = path.join(uploadsDir, fname);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(fpath, minimalJpeg);
    writtenFiles.push(fpath);

    db.prepare('UPDATE assets SET filepath = ? WHERE id = ?').run(`uploads/${fname}`, id);

    app.locals.anthropic = makeMockAnthropic({
      ...mockAiPayload,
      destination_region: 'Caribbean',
      content_type: 'ship-exterior',
    });

    const res = await request(app).post(`/api/assets/${encodeURIComponent(id)}/enrich`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enriched_content_type');
    expect(res.body.enriched_content_type).toBe('ship-exterior');
  });
});

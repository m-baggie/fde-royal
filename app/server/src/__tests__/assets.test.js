'use strict';

const path = require('path');
const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('GET /api/assets', () => {
  it('returns 200 with total 49 when show_all_variants=1', async () => {
    const res = await request(app).get('/api/assets?show_all_variants=1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(49);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets.length).toBeGreaterThan(0);
  });

  it('q=sunset returns at least 1 result', async () => {
    const res = await request(app).get('/api/assets?q=sunset');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.assets.length).toBeGreaterThanOrEqual(1);
  });

  it('category=ships returns only ships assets', async () => {
    const res = await request(app).get('/api/assets?category=ships');
    expect(res.status).toBe(200);
    expect(res.body.assets.length).toBeGreaterThan(0);
    for (const asset of res.body.assets) {
      expect(asset.category).toBe('ships');
    }
  });

  it('rights_status=none returns exactly 27 assets when show_all_variants=1', async () => {
    const res = await request(app).get('/api/assets?rights_status=none&show_all_variants=1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(27);
    expect(res.body.assets.length).toBe(27);
  });

  it('limit=5&offset=0 with show_all_variants=1 returns 5 assets with total=49', async () => {
    const res = await request(app).get('/api/assets?limit=5&offset=0&show_all_variants=1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(49);
    expect(res.body.assets.length).toBe(5);
  });

  it('q=zzznomatch returns 200 { total: 0, assets: [] }', async () => {
    const res = await request(app).get('/api/assets?q=zzznomatch');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.assets).toEqual([]);
  });

  it('each asset in response includes required fields', async () => {
    const res = await request(app).get('/api/assets?limit=1');
    expect(res.status).toBe(200);
    const asset = res.body.assets[0];
    const requiredFields = [
      'id', 'filename', 'category', 'subcategory',
      'display_title', 'display_description', 'display_tags',
      'thumbnail_path', 'web_image_path',
      'enriched_rights_status', 'enrichment_source',
      'width', 'height',
      'scene7_file', 'scene7_domain',
      's7_sync_error', 'needs_rights_review', 'has_release_placeholder',
    ];
    for (const field of requiredFields) {
      expect(asset).toHaveProperty(field);
    }
    expect(Array.isArray(asset.display_tags)).toBe(true);
  });
});

describe('GET /api/assets — channel and scene filters', () => {
  const TEST_IDS = ['__test_ch_scene_1__', '__test_ch_scene_2__'];

  beforeEach(() => {
    db.prepare(
      `INSERT OR REPLACE INTO assets (id, filename, enriched_channel, enriched_scene)
       VALUES (?, ?, ?, ?)`
    ).run(TEST_IDS[0], 'test-hero.jpg', 'hero', 'ocean');
    db.prepare(
      `INSERT OR REPLACE INTO assets (id, filename, enriched_channel, enriched_scene)
       VALUES (?, ?, ?, ?)`
    ).run(TEST_IDS[1], 'test-banner.jpg', 'banner', 'mountain');
  });

  afterEach(() => {
    for (const id of TEST_IDS) {
      db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    }
  });

  it('channel=hero returns only assets with enriched_channel=hero', async () => {
    const res = await request(app).get('/api/assets?channel=hero');
    expect(res.status).toBe(200);
    expect(res.body.assets.length).toBeGreaterThan(0);
    for (const asset of res.body.assets) {
      expect(asset.enriched_channel).toBe('hero');
    }
  });

  it('scene=ocean returns only assets with enriched_scene=ocean', async () => {
    const res = await request(app).get('/api/assets?scene=ocean');
    expect(res.status).toBe(200);
    expect(res.body.assets.length).toBeGreaterThan(0);
    for (const asset of res.body.assets) {
      expect(asset.enriched_scene).toBe('ocean');
    }
  });

  it('channel=nonexistent returns { total: 0, assets: [] } with 200 status', async () => {
    const res = await request(app).get('/api/assets?channel=nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.assets).toEqual([]);
  });

  it('channel and scene compose correctly with category filter', async () => {
    // Insert asset with all three fields set
    const COMBO_ID = '__test_ch_scene_combo__';
    db.prepare(
      `INSERT OR REPLACE INTO assets (id, filename, category, enriched_channel, enriched_scene)
       VALUES (?, ?, ?, ?, ?)`
    ).run(COMBO_ID, 'combo.jpg', 'ships', 'hero', 'ocean');
    try {
      const res = await request(app).get('/api/assets?category=ships&channel=hero&scene=ocean');
      expect(res.status).toBe(200);
      const ids = res.body.assets.map((a) => a.id);
      expect(ids).toContain(COMBO_ID);
      for (const asset of res.body.assets) {
        expect(asset.category).toBe('ships');
        expect(asset.enriched_channel).toBe('hero');
        expect(asset.enriched_scene).toBe('ocean');
      }
    } finally {
      db.prepare('DELETE FROM assets WHERE id = ?').run(COMBO_ID);
    }
  });
});

describe('GET /api/assets/:id', () => {
  it('returns correct original_title for anthem-of-the-seas-new-york-statue-liberty.jpg', async () => {
    const res = await request(app).get(
      '/api/assets/anthem-of-the-seas-new-york-statue-liberty.jpg'
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('anthem-of-the-seas-new-york-statue-liberty.jpg');
    expect(res.body).toHaveProperty('original_title');
  });

  it('an asset with enriched_rights_status=none has missing_rights in quality_issues', async () => {
    const res = await request(app).get('/api/assets?rights_status=none&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.assets.length).toBeGreaterThan(0);
    const id = res.body.assets[0].id;
    const detail = await request(app).get(`/api/assets/${encodeURIComponent(id)}`);
    expect(detail.status).toBe(200);
    expect(detail.body.quality_issues).toContain('missing_rights');
  });

  it('an asset with has_release_placeholder=1 has release_placeholder in quality_issues', async () => {
    const res = await request(app).get('/api/assets?has_release_placeholder=true&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.assets.length).toBeGreaterThan(0);
    const id = res.body.assets[0].id;
    const detail = await request(app).get(`/api/assets/${encodeURIComponent(id)}`);
    expect(detail.status).toBe(200);
    expect(detail.body.quality_issues).toContain('release_placeholder');
  });

  it('cdn_url is correctly formatted for an asset with scene7_file set', async () => {
    // Find an asset that has a scene7_file
    const list = await request(app).get('/api/assets?limit=200');
    const withS7 = list.body.assets.find((a) => a.scene7_file && a.scene7_domain);
    if (!withS7) {
      // No asset with scene7 data — skip gracefully
      return;
    }
    const detail = await request(app).get(`/api/assets/${encodeURIComponent(withS7.id)}`);
    expect(detail.status).toBe(200);
    // cdn_url must not contain '//' (trailing slash stripped from domain)
    expect(detail.body.cdn_url).not.toContain('//is/image/');
    const expectedDomain = withS7.scene7_domain.replace(/\/+$/, '');
    expect(detail.body.cdn_url).toBe(
      `${expectedDomain}/is/image/${withS7.scene7_file}`
    );
  });

  it('cdn_url for dubai asset equals expected URL with single slash', async () => {
    const res = await request(app).get(
      '/api/assets/dubai-arabian-gulf-emirates-burj-al-arab-skyline.jpg'
    );
    if (res.status === 404) return; // asset not in DB — skip
    expect(res.status).toBe(200);
    if (res.body.scene7_domain && res.body.scene7_file) {
      expect(res.body.cdn_url).toBe(
        'https://assets.dm.rccl.com/is/image/RoyalCaribbeanCruises/dubai-arabian-gulf-emirates-burj-al-arab-skyline'
      );
    }
  });

  it('cdn_url for any asset with scene7_domain set does not contain "//"', async () => {
    const list = await request(app).get('/api/assets?limit=200');
    expect(list.status).toBe(200);
    const withS7 = list.body.assets.filter((a) => a.scene7_file && a.scene7_domain);
    for (const asset of withS7) {
      const detail = await request(app).get(`/api/assets/${encodeURIComponent(asset.id)}`);
      expect(detail.status).toBe(200);
      expect(detail.body.cdn_url).not.toMatch(/\/\/is\/image\//);
    }
  });

  it('cdn_url is null when scene7_file is not set', async () => {
    // Find an asset without scene7_file
    const list = await request(app).get('/api/assets?limit=200');
    const noS7 = list.body.assets.find((a) => !a.scene7_file);
    if (!noS7) return; // all assets have scene7_file — skip
    const detail = await request(app).get(`/api/assets/${encodeURIComponent(noS7.id)}`);
    expect(detail.status).toBe(200);
    expect(detail.body.cdn_url).toBeNull();
  });

  it('returns 404 with error message for non-existent asset', async () => {
    const res = await request(app).get('/api/assets/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Asset not found' });
  });
});

describe('GET /api/assets — variant_count (US-002)', () => {
  it('galveston primary asset has variant_count=4', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    const galveston = res.body.assets.find(
      (a) => a.id === 'allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg'
    );
    expect(galveston).toBeDefined();
    expect(galveston.variant_count).toBe(4);
  });

  it('ungrouped asset has variant_count=1', async () => {
    // anthem-of-the-seas-new-york-statue-liberty.jpg is not in any group
    const res = await request(app).get(
      '/api/assets?show_all_variants=1'
    );
    expect(res.status).toBe(200);
    const anthem = res.body.assets.find(
      (a) => a.id === 'anthem-of-the-seas-new-york-statue-liberty.jpg'
    );
    expect(anthem).toBeDefined();
    expect(anthem.variant_count).toBe(1);
  });
});

describe('GET /api/assets/:id/variants (US-002)', () => {
  it('galveston primary returns 4 variants', async () => {
    const res = await request(app).get(
      '/api/assets/allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg/variants'
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
  });

  it('any galveston variant returns 4 items', async () => {
    const res = await request(app).get(
      '/api/assets/allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner.jpg/variants'
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
  });

  it('ungrouped asset returns empty array', async () => {
    const res = await request(app).get(
      '/api/assets/anthem-of-the-seas-new-york-statue-liberty.jpg/variants'
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('non-existent asset returns 404', async () => {
    const res = await request(app).get('/api/assets/does-not-exist-ever/variants');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/assets/:id/download (US-003)', () => {
  let originalDataRoot;

  beforeAll(() => {
    // Override dataRoot to the real DAM data directory (same path as jest.globalSetup.js)
    originalDataRoot = app.locals.dataRoot;
    app.locals.dataRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', 'Royal Caribbean', 'Data', 'royal');
  });

  afterAll(() => {
    app.locals.dataRoot = originalDataRoot;
  });

  it('returns 200 with Content-Disposition attachment for a valid asset', async () => {
    // Pick the first asset that has a web_image_path or thumbnail_path
    const list = await request(app).get('/api/assets?show_all_variants=1&limit=200');
    const asset = list.body.assets.find((a) => a.web_image_path || a.thumbnail_path);
    if (!asset) return; // no asset has a file path — skip
    const res = await request(app).get(`/api/assets/${encodeURIComponent(asset.id)}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it('returns 404 for a non-existent asset id', async () => {
    const res = await request(app).get('/api/assets/nonexistent/download');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Asset not found' });
  });
});

describe('GET /api/assets — query expansion (US-001)', () => {
  it('GET /api/assets?q=sunset returns results (expansion skipped — no API key in tests)', async () => {
    const res = await request(app).get('/api/assets?q=sunset');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets.length).toBeGreaterThanOrEqual(1);
  });

  it('search works when ANTHROPIC_API_KEY is not set (falls back to plain FTS5)', async () => {
    // In the test environment app.locals.anthropic is undefined (no key set)
    // expandQuery must return original q so search still works normally
    expect(app.locals.anthropic).toBeUndefined();
    const res = await request(app).get('/api/assets?q=aerial');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/assets — variant grouping (US-001)', () => {
  it('default (no params) returns fewer than 49 assets due to grouping', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeLessThan(49);
    expect(Array.isArray(res.body.assets)).toBe(true);
  });

  it('show_all_variants=1 returns all 49 assets (no grouping filter)', async () => {
    const res = await request(app).get('/api/assets?show_all_variants=1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(49);
  });

  it('default mode returns fewer assets than show_all_variants=1', async () => {
    const grouped = await request(app).get('/api/assets');
    const flat = await request(app).get('/api/assets?show_all_variants=1');
    expect(grouped.body.total).toBeLessThan(flat.body.total);
  });

  it('galveston primary asset appears in default mode', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    const ids = res.body.assets.map((a) => a.id);
    expect(ids).toContain('allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg');
  });

  it('non-primary galveston asset does not appear in default mode', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    const ids = res.body.assets.map((a) => a.id);
    // These are non-primary galveston variants — should be hidden in grouped mode
    expect(ids).not.toContain('allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner.jpg');
    expect(ids).not.toContain('allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner-height.jpg');
  });

  it('non-primary galveston assets appear with show_all_variants=1', async () => {
    const res = await request(app).get('/api/assets?show_all_variants=1');
    expect(res.status).toBe(200);
    const ids = res.body.assets.map((a) => a.id);
    expect(ids).toContain('allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner.jpg');
    expect(ids).toContain('allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg');
  });
});

'use strict';

const request = require('supertest');
const app = require('../index');

describe('GET /api/assets', () => {
  it('returns 200 with total 49 when no params given', async () => {
    const res = await request(app).get('/api/assets');
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

  it('rights_status=none returns exactly 27 assets', async () => {
    const res = await request(app).get('/api/assets?rights_status=none');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(27);
    expect(res.body.assets.length).toBe(27);
  });

  it('limit=5&offset=0 returns 5 assets with total=49', async () => {
    const res = await request(app).get('/api/assets?limit=5&offset=0');
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
    expect(detail.body.cdn_url).toBe(
      `${withS7.scene7_domain}/is/image/${withS7.scene7_file}`
    );
  });

  it('returns 404 with error message for non-existent asset', async () => {
    const res = await request(app).get('/api/assets/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Asset not found' });
  });
});

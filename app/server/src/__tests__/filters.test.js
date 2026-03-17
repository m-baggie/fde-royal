'use strict';

const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('GET /api/filters', () => {
  it('returns 200 with expected shape', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(typeof res.body.subcategories).toBe('object');
    expect(Array.isArray(res.body.locations)).toBe(true);
    expect(Array.isArray(res.body.rights_statuses)).toBe(true);
    expect(typeof res.body.counts).toBe('object');
  });

  it('categories contains ships and promotions', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body.categories).toContain('ships');
    expect(res.body.categories).toContain('promotions');
  });

  it('subcategories.ships contains allure, anthem, grandeur', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body.subcategories.ships).toContain('allure');
    expect(res.body.subcategories.ships).toContain('anthem');
    expect(res.body.subcategories.ships).toContain('grandeur');
  });

  it('counts.has_release_placeholder equals 7', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body.counts.has_release_placeholder).toBe(7);
  });

  it('counts.total equals 49', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body.counts.total).toBe(49);
  });

  it('rights_statuses contains entries for owned, unclear, none', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const values = res.body.rights_statuses.map((r) => r.value);
    expect(values).toContain('owned');
    expect(values).toContain('unclear');
    expect(values).toContain('none');
  });

  it('categories array is sorted', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const cats = res.body.categories;
    expect(cats).toEqual([...cats].sort());
  });

  it('locations array is sorted and deduplicated', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const locs = res.body.locations;
    expect(locs).toEqual([...new Set(locs)].sort());
  });

  it('returns channels and scenes as arrays (may be empty before enrichment)', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(Array.isArray(res.body.scenes)).toBe(true);
  });

  describe('channels and scenes with enriched data', () => {
    const TEST_ID = '__test_channel_scene__';

    beforeEach(() => {
      db.prepare(
        `INSERT OR REPLACE INTO assets (id, filename, enriched_channel, enriched_scene)
         VALUES (?, ?, ?, ?)`
      ).run(TEST_ID, 'test.jpg', 'hero', 'ocean');
    });

    afterEach(() => {
      db.prepare('DELETE FROM assets WHERE id = ?').run(TEST_ID);
    });

    it('channels includes hero after inserting asset with enriched_channel=hero', async () => {
      const res = await request(app).get('/api/filters');
      expect(res.status).toBe(200);
      expect(res.body.channels).toContain('hero');
    });

    it('scenes includes ocean after inserting asset with enriched_scene=ocean', async () => {
      const res = await request(app).get('/api/filters');
      expect(res.status).toBe(200);
      expect(res.body.scenes).toContain('ocean');
    });

    it('channels array is sorted alphabetically', async () => {
      const res = await request(app).get('/api/filters');
      expect(res.status).toBe(200);
      const ch = res.body.channels;
      expect(ch).toEqual([...ch].sort());
    });

    it('scenes array is sorted alphabetically', async () => {
      const res = await request(app).get('/api/filters');
      expect(res.status).toBe(200);
      const sc = res.body.scenes;
      expect(sc).toEqual([...sc].sort());
    });
  });
});

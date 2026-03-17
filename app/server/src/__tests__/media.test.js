'use strict';

const request = require('supertest');
const app = require('../index');

describe('GET /api/assets/media', () => {
  it('returns 200 or 404 (not 500) for a known thumbnail path', async () => {
    const res = await request(app).get(
      '/api/assets/media/ships/allure/allure-of-the-seas-aerial-sailing-blue-sky.JPG/_jcr_content/renditions/cq5dam.thumbnail.319.319.png'
    );
    expect(res.status).not.toBe(500);
    expect([200, 404]).toContain(res.status);
  });

  it('returns 404 for a nonexistent path', async () => {
    const res = await request(app).get('/api/assets/media/nonexistent/path.png');
    expect(res.status).toBe(404);
  });
});

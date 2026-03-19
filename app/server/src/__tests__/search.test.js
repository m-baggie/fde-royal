'use strict';

const request = require('supertest');
const app = require('../index');

describe('POST /api/search/prompt', () => {
  it('returns 200 with assets array and total for a valid prompt', async () => {
    const res = await request(app)
      .post('/api/search/prompt')
      .send({ prompt: 'ships at sunset' });
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.assets)).toBe(true);
    // explanation is either a string or null depending on API key availability
    expect(res.body).toHaveProperty('explanation');
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/search/prompt')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when prompt is an empty string', async () => {
    const res = await request(app)
      .post('/api/search/prompt')
      .send({ prompt: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/search/prompt');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('falls back gracefully when anthropic is null', async () => {
    // Temporarily remove anthropic from app locals
    const original = app.locals.anthropic;
    app.locals.anthropic = null;

    try {
      const res = await request(app)
        .post('/api/search/prompt')
        .send({ prompt: 'ships at sunset' });
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
      expect(Array.isArray(res.body.assets)).toBe(true);
      expect(res.body.explanation).toBeNull();
    } finally {
      app.locals.anthropic = original;
    }
  });
});

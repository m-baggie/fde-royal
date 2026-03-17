'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../index');
const db = require('../db');

// Track state for cleanup
const uploadedFiles = [];
const insertedIds = [];

afterAll(() => {
  // Remove test assets from DB
  const del = db.prepare('DELETE FROM assets WHERE id = ?');
  for (const id of insertedIds) {
    del.run(id);
  }
  // Remove uploaded files from disk
  for (const filepath of uploadedFiles) {
    try { fs.unlinkSync(filepath); } catch (_) { /* ignore */ }
  }
});

// Minimal valid JPEG header bytes
const minimalJpeg = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const uploadsDir = path.join(__dirname, '../../../uploads');

function trackUpload(asset) {
  insertedIds.push(asset.id);
  uploadedFiles.push(path.join(uploadsDir, path.basename(asset.filepath)));
}

describe('POST /api/assets/upload', () => {
  it('returns 201 with asset id when a valid JPEG is uploaded', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .attach('files', minimalJpeg, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.uploaded).toBe(1);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets[0]).toHaveProperty('id');
    expect(res.body.assets[0]).toHaveProperty('filename', 'test.jpg');
    expect(res.body.assets[0]).toHaveProperty('filepath');

    trackUpload(res.body.assets[0]);
  });

  it('uploaded asset is retrievable via GET /api/assets/:id', async () => {
    const uploadRes = await request(app)
      .post('/api/assets/upload')
      .attach('files', minimalJpeg, { filename: 'retrievable.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.status).toBe(201);
    const asset = uploadRes.body.assets[0];
    trackUpload(asset);

    const getRes = await request(app).get(`/api/assets/${encodeURIComponent(asset.id)}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(asset.id);
  });

  it('file exists on disk at the filepath in the response', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .attach('files', minimalJpeg, { filename: 'diskcheck.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    const asset = res.body.assets[0];
    trackUpload(asset);

    // filepath is relative like "uploads/<uuid>-diskcheck.jpg"; resolve from app root
    const absPath = path.join(__dirname, '../../../', asset.filepath);
    expect(fs.existsSync(absPath)).toBe(true);
  });

  it('POST with a .txt file returns 400 with unsupported type error', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .attach('files', Buffer.from('hello world'), { filename: 'test.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unsupported file type. Accepted: jpeg, png, webp' });
  });

  it('POST with no files field returns 400 { error: "No files provided" }', async () => {
    const res = await request(app)
      .post('/api/assets/upload')
      .field('other', 'value');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No files provided' });
  });

  it('oversized file returns 413 { error: "File too large. Maximum size is 20MB" }', async () => {
    const bigBuffer = Buffer.alloc(21 * 1024 * 1024);
    const res = await request(app)
      .post('/api/assets/upload')
      .attach('files', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'File too large. Maximum size is 20MB' });
  });
});

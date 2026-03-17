'use strict';

const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const uploadsDir = path.join(__dirname, '../../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    cb(null, `${id}-${file.originalname}`);
  },
});

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fileFilter = (_req, file, cb) => {
  if (ACCEPTED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Accepted: jpeg, png, webp'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = Router();

const insertStmt = db.prepare(`
  INSERT INTO assets (id, filename, filepath, mime_type, file_size, category, enrichment_source, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

router.post('/upload', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 20MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const now = new Date().toISOString();
  const assets = [];

  for (const file of req.files) {
    // The filename on disk is "<uuid>-<originalname>"; uuid is always 36 chars
    const id = file.filename.slice(0, 36);
    const filepath = `uploads/${file.filename}`;
    insertStmt.run(id, file.originalname, filepath, file.mimetype, file.size, 'uploaded', 'pending', now);
    assets.push({ id, filename: file.originalname, filepath });
  }

  res.status(201).json({ uploaded: assets.length, assets });
});

module.exports = router;

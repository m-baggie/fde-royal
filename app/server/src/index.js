const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db'); // initialize SQLite and run migrations on startup
const { ingestAssets } = require('./services/ingest');

const assetsRouter = require('./routes/assets');
const filtersRouter = require('./routes/filters');
const uploadRouter = require('./routes/upload');

const app = express();

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/ }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Resolve DATA_ROOT once — used by the media static route and the download endpoint
const dataRoot = path.resolve(__dirname, '..', '..', process.env.DATA_DIR || '../Data/royal');
app.locals.dataRoot = dataRoot;

// Static DAM media files — registered before API routers
app.use('/api/assets/media', express.static(dataRoot));

// Upload router must be registered before assetsRouter to avoid /:id capturing /upload
app.use('/api/assets', uploadRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/filters', filtersRouter);

if (process.env.ANTHROPIC_API_KEY) {
  app.locals.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  console.warn('AI enrichment and query expansion disabled: ANTHROPIC_API_KEY not set');
}

// Ingest assets on first startup (only if the table is empty)
const assetCount = db.prepare('SELECT COUNT(*) AS n FROM assets').get().n;
if (assetCount === 0) {
  const dataDir = process.env.DATA_DIR || '../Data/royal';
  const ingested = ingestAssets(db, dataDir);
  console.log(`Ingested ${ingested} assets`);
}

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

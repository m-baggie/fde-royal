require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const db = require('./db'); // initialize SQLite and run migrations on startup
const { ingestAssets } = require('./services/ingest');

const assetsRouter = require('./routes/assets');
const filtersRouter = require('./routes/filters');
const uploadRouter = require('./routes/upload');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Upload router must be registered before assetsRouter to avoid /:id capturing /upload
app.use('/api/assets', uploadRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/filters', filtersRouter);

if (process.env.OPENAI_API_KEY) {
  app.locals.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  console.warn('AI enrichment disabled: OPENAI_API_KEY not set');
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

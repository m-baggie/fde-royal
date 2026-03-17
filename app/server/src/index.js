require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // initialize SQLite and run migrations on startup
const { ingestAssets } = require('./services/ingest');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (!process.env.OPENAI_API_KEY) {
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

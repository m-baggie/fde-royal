# Progress Log
Started: Tue Mar 17 11:21:30 EDT 2026

## Codebase Patterns
- (add reusable patterns here)

---

## [2026-03-17 11:25] - US-001: Scaffold monorepo — Express + React Vite
Thread:
Run: 20260317-112130-86970 (iteration 1)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-1.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 99b695f feat(monorepo): scaffold Express backend and React Vite frontend
- Post-commit status: clean (only .agents/tasks/prd-foundation.json remains modified — per rules, not edited)
- Verification:
  - `npm run lint` -> PASS
  - `npm run build` -> PASS (vite build, 142 kB bundle)
  - `npm test` -> PASS (Jest: 1 passed, Vitest: 1 passed)
  - Browser: <h1>Royal Caribbean DAM</h1> visible at localhost:5173 -> PASS
- Files changed:
  - package.json (root workspace)
  - package-lock.json
  - server/package.json
  - server/.eslintrc.json
  - server/src/index.js
  - server/src/__tests__/health.test.js
  - client/package.json
  - client/vite.config.js
  - client/index.html
  - client/src/App.jsx
  - client/src/main.jsx
  - client/src/App.test.jsx
  - client/src/test-setup.js
  - client/.eslintrc.json
  - .env.example
  - .gitignore
  - uploads/.gitkeep
  - AGENTS.md
- What was implemented:
  - Full monorepo scaffold with npm workspaces [client, server]
  - Express server with CORS, health endpoint, OPENAI_API_KEY warning
  - React 18 + Vite 5 client (manually scaffolded — create-vite@latest requires Node >=20)
  - Jest test for GET /api/health, Vitest test for App render
  - concurrently at root for `npm run dev`
- **Learnings for future iterations:**
  - Node 18.20.3 is in use — `create-vite@latest` (v9) requires Node >=20 and will fail; scaffold client manually or pin `create-vite@5`
  - `app.listen` must be guarded by `require.main === module` so supertest can import the app without binding a port
  - `dist/` was committed — add `client/dist/` to .gitignore in a follow-up or ensure build is not run before staging
---

## [2026-03-17 11:32] - US-002: SQLite schema, migrations, and FTS5 triggers
Thread:
Run: 20260317-112130-86970 (iteration 2)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-2.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 00f3a5e feat(db): add SQLite schema, FTS5 virtual table, and sync triggers
- Post-commit status: clean
- Verification:
  - `npm test` (server Jest) -> PASS (7 tests: 5 db + 2 health)
  - `npm run lint` -> PASS
  - `npm run build` -> PASS (vite, 142 kB)
  - `npm test` (full) -> PASS (Jest 7 passed, Vitest 1 passed)
- Files changed:
  - server/src/db/schema.js (new)
  - server/src/db/index.js (new)
  - server/src/__tests__/db.test.js (new)
  - server/src/index.js (added `require('./db')`)
- What was implemented:
  - `runMigrations(db)` creates assets table (44 columns per data model), assets_fts FTS5 virtual table with content='assets', and three sync triggers (assets_ai, assets_au, assets_ad)
  - db/index.js opens dam.sqlite at project root, calls runMigrations; catches errors and exits with code 1
  - index.js imports db on startup to trigger migrations
  - 5 Jest tests: table creation, idempotent migrations, INSERT→FTS, UPDATE→FTS, DELETE→FTS
- **Learnings for future iterations:**
  - FTS5 content tables (`content='assets'`) read column values from the content table using FTS column names at query time. Since assets uses `enriched_title` but FTS has `title`, `SELECT *` from assets_fts fails with "no such column: T.title". Correct pattern: query `SELECT rowid FROM assets_fts WHERE MATCH` and compare to lastInsertRowid
  - FTS5 triggers: INSERT uses direct insert; UPDATE needs delete-old + insert-new pattern; DELETE uses the special `'delete'` command
  - `CREATE TRIGGER IF NOT EXISTS` works correctly for idempotent re-runs
---

## [2026-03-17 11:43] - US-003: XML ingest service — parse DAM export into SQLite
Thread:
Run: 20260317-112130-86970 (iteration 3)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-3.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.foundation/app/.ralph/runs/run-20260317-112130-86970-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: ac866f1 feat(ingest): add XML ingest service for AEM DAM assets
- Post-commit status: clean
- Verification:
  - `npm run lint` -> PASS
  - `npm run build` -> PASS (vite, 142 kB)
  - `npm test` -> PASS (Jest 16 passed, Vitest 1 passed)
- Files changed:
  - server/src/services/ingest.js (new)
  - server/src/__tests__/ingest.test.js (new)
  - server/src/index.js (added ingest-on-startup logic)
  - server/package.json (added fast-xml-parser dependency)
  - package-lock.json
- What was implemented:
  - `ingestAssets(db, dataDir)` recursively walks dataDir, finds .content.xml files where parent folder name ends in .jpg/.jpeg/.png/.JPG and path excludes _jcr_content
  - fast-xml-parser with ignoreAttributes: false and @_ attribute prefix for namespace-aware parsing
  - JCR type stripping: {Long}1920 → 1920, {Boolean}true → 'true', {Date}... → raw string
  - Reads all 15 namespace-mapped fields from metadata element; dam:lastS7SyncStatus from jcr:content element
  - Deterministic rules: creator normalization, rights reconciliation (owned/unclear/none), channel/format inference, Selecione placeholder detection, s7_sync_error flag
  - thumbnail_path and web_image_path set from actual rendition files on disk
  - INSERT OR IGNORE for safe re-runs; index.js triggers ingest on startup if assets count = 0
  - 9 Jest tests covering all acceptance criteria
- **Learnings for future iterations:**
  - Data lives at `../FDE/Royal Caribbean/Data/royal` (sibling dir); test paths need 5 levels up from __tests__ then into `Royal Caribbean/Data/royal`
  - fast-xml-parser v4: use `parseAttributeValue: false`; namespace attrs like `dc:title` accessed as `@_dc:title`
  - dam:lastS7SyncStatus is on jcr:content element, not the metadata child
  - Selecione placeholder: `Object.values(metadata).some(v => typeof v === 'string' && v.includes('Selecione'))` catches all 7
  - xmpRights:Owner has trailing spaces — always trim before rights comparison
---

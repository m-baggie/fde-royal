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

## [2026-03-17 12:00] - US-005: GET /api/assets/:id — asset detail endpoint
Thread:
Run: 20260317-115046-14307 (iteration 2)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-2.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 4bdbe49 feat(api): add GET /api/assets/:id detail endpoint
- Post-commit status: clean (only prd-api.json + ralph run artifacts remain)
- Verification:
  - `npm run lint` -> PASS
  - `npm run build` -> PASS (vite, 142 kB)
  - `npm test` -> PASS (Jest 28 passed, Vitest 1 passed)
- Files changed:
  - server/src/routes/assets.js (added GET /:id handler)
  - server/src/__tests__/assets.test.js (added 5 new tests for US-005)
- What was implemented:
  - `GET /api/assets/:id` route: SELECT * FROM assets WHERE id=?; returns 404 { error: 'Asset not found' } if missing
  - cdn_url computed as `scene7_domain + '/is/image/' + scene7_file` (null if either missing)
  - quality_issues array: missing_title, missing_description, missing_rights, missing_location, title_equals_description, s7_sync_error, release_placeholder
  - display_title, display_description, display_tags computed identical to search formatAssets
  - 5 supertest tests: anthem asset present with original_title; missing_rights for rights_status=none asset; release_placeholder for has_release_placeholder=1 asset; cdn_url format for scene7 asset; 404 for does-not-exist
- **Learnings for future iterations:**
  - Route order matters: `/:id` must be registered AFTER `/` in Express to avoid shadowing the collection route
  - `SELECT *` is safe here since it's a single-row detail endpoint; no performance concern
  - quality_issues isEmpty check must handle null, undefined, and '' to match SQLite NULLs and empty strings consistently
---

## [2026-03-17 11:57] - US-004: GET /api/assets — search and filter endpoint
Thread:
Run: 20260317-115046-14307 (iteration 1)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-1.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: a49972b feat(api): add GET /api/assets search and filter endpoint
- Post-commit status: clean (only prd-api.json + ralph run artifacts remain — not editable per rules)
- Verification:
  - `npm run lint` -> PASS
  - `npm run build` -> PASS (vite, 142 kB)
  - `npm test` -> PASS (Jest 23 passed, Vitest 1 passed)
- Files changed:
  - server/src/services/search.js (new)
  - server/src/routes/assets.js (new)
  - server/src/__tests__/assets.test.js (new)
  - server/jest.globalSetup.js (new)
  - server/package.json (added jest.globalSetup config)
  - server/src/index.js (mounted assetsRouter at /api/assets)
  - .ralph/activity.log
- What was implemented:
  - `searchAssets(db, params)` in services/search.js — FTS5 MATCH primary path (ranked by rank), automatic LIKE fallback when FTS returns 0; structured filter conditions for category, subcategory, rights_status, location, has_title, has_rights, has_release_placeholder; pagination (limit 1-200, offset ≥ 0); display field computation (display_title, display_description, display_tags)
  - Express Router in routes/assets.js with GET / handler
  - Registered in index.js: `app.use('/api/assets', assetsRouter)`
  - jest.globalSetup.js pre-populates dam.sqlite with real data before supertest suites run (avoids 0-row failures in fresh worktrees)
  - 7 supertest test cases covering all AC: total=49, q=sunset, category=ships, rights_status=none=27, pagination, required fields, q=zzznomatch=0
- **Learnings for future iterations:**
  - In fresh worktrees, dam.sqlite doesn't exist — supertest tests against `app` get 0 rows because DATA_DIR defaults to `../Data/royal` (wrong relative path). Fix: jest `globalSetup` that pre-populates with the correct absolute path before suites run
  - FTS5 MATCH with wrapped q in double quotes isn't needed — raw string works fine for single words; try/catch handles syntax errors and falls back to LIKE
  - FTS5 at ingest time indexes `enriched_*` fields (all null) + filename/category/subcategory — so FTS search on `q=sunset` hits the filename column where "sunset" is tokenized from hyphens like "allure-of-the-seas-sunset.jpg"
  - `better-sqlite3` `.all(...args)` with spread works correctly; no need to wrap args in array
---

## [2026-03-17 12:03] - US-006: GET /api/filters — filter options endpoint
Thread:
Run: 20260317-115046-14307 (iteration 3)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-3.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 70b0548 feat(api): add GET /api/filters filter options endpoint
- Post-commit status: clean (ralph/prd files excluded from this commit)
- Verification:
  - npm test -> PASS (36 tests across 5 suites)
  - npm run lint -> PASS
  - npm run build -> PASS
- Files changed:
  - server/src/routes/filters.js (new)
  - server/src/__tests__/filters.test.js (new)
  - server/src/index.js (register filtersRouter)
- What was implemented:
  - GET /api/filters route returning categories (sorted), subcategories (keyed by category), locations (merged original+enriched, deduped, sorted), rights_statuses (owned/unclear/none with counts), and quality counts
  - 8 Supertest tests covering shape, categories, subcategories.ships, counts.total=49, counts.has_release_placeholder=7, rights_statuses presence, sort order
- **Learnings for future iterations:**
  - UNION query is the cleanest way to merge original_location + enriched_location without duplicates
  - Ensure all three rights_status values (owned/unclear/none) are present in response even if count=0 — initialize map before iterating DB results
  - ralph activity logger script not present in this repo; skip that step
---

## [2026-03-17 12:08] - US-007: POST /api/assets/upload — multi-file upload endpoint
Thread:
Run: 20260317-115046-14307 (iteration 4)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-4.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-4.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 217f7e1 feat(api): add POST /api/assets/upload multi-file upload endpoint
- Post-commit status: clean (ralph/prd files excluded from this commit)
- Verification:
  - npm run lint -> PASS
  - npm run build -> PASS
  - npm test -> PASS (42 tests across 6 suites)
- Files changed:
  - server/src/routes/upload.js (new)
  - server/src/__tests__/upload.test.js (new)
  - server/src/index.js (register uploadRouter before assetsRouter)
- What was implemented:
  - multer diskStorage saving to app/uploads/ with filename <uuid>-<originalname>
  - fileFilter rejecting non-image MIME types with error message per spec
  - 20 MB fileSize limit returning 413 on breach
  - uuid v4 used as both asset id and prefix in disk filename; extracted via slice(0,36)
  - DB insert per file: id, filename, filepath, mime_type, file_size, category=uploaded, enrichment_source=pending
  - 201 response { uploaded: N, assets: [{ id, filename, filepath }] }
  - uploadRouter registered before assetsRouter so POST /upload is not captured by GET /:id
  - 6 supertest tests: happy path, GET retrieval, disk existence, txt rejection, no-files, oversized
  - afterAll cleanup: removes inserted DB rows and uploaded files so 49-asset count tests stay stable
- **Learnings for future iterations:**
  - UUID is always 36 chars; file.filename.slice(0,36) cleanly extracts id from diskStorage filename
  - Register upload router before assets router to prevent /:id from matching /upload
  - afterAll DB cleanup is critical when upload tests insert rows — existing total=49 tests would fail otherwise
  - ralph activity logger script not present in this repo; log directly to activity.log
---

## [2026-03-17 12:14] - US-008: POST /api/assets/:id/enrich — OpenAI Vision enrichment endpoint
Thread:
Run: 20260317-115046-14307 (iteration 5)
Run log: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-5.log
Run summary: /Users/mbaggie/Dev/FDE/Royal Caribbean.feature-api/app/.ralph/runs/run-20260317-115046-14307-iter-5.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 345d9a4 feat(api): add POST /api/assets/:id/enrich OpenAI Vision enrichment
- Post-commit status: ralph logs and prd-api.json remain (managed by ralph harness)
- Verification:
  - Command: npm run lint -> PASS
  - Command: npm run build -> PASS
  - Command: npm test -> PASS (53 tests, 7 suites)
- Files changed:
  - server/src/services/enrich.js (new)
  - server/src/__tests__/enrich.test.js (new)
  - server/src/routes/assets.js (added POST /:id/enrich + enrichAsset import)
  - server/src/index.js (OpenAI client init via app.locals.openai)
- What was implemented:
  - enrichAsset(db, id, openaiClient): reads asset filepath, converts image to base64, calls gpt-4o vision with JSON-only prompt, parses response, updates all enriched_* columns + enrichment_source='ai-vision'
  - POST /api/assets/:id/enrich route: delegates to enrichAsset, returns 200 with full updated row; 503 if no OpenAI key, 400/404 for asset issues, 502 on OpenAI error
  - OpenAI initialized in index.js only if OPENAI_API_KEY is present, stored as app.locals.openai
  - 9 Jest tests: field mapping, enriched_title non-null, FTS search after enrich, all 3 negative service cases, all 4 HTTP route cases
- **Learnings for future iterations:**
  - jest.mock('openai') auto-mock prevents accidental real API calls; remove unused import to pass no-unused-vars lint
  - `app.locals` is the correct Express pattern for sharing singletons across routes without circular deps
  - FTS5 update trigger fires on UPDATE so FTS search works immediately after enrichAsset writes enriched_title
  - filepath in DB is relative to app root (e.g. "uploads/uuid-name.jpg"); resolve with path.join(__dirname, '../../../', filepath) from services/
---

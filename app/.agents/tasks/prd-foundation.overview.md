# PRD Overview: Royal Caribbean DAM — Foundation

- File: .agents/tasks/prd-foundation.json
- Stories: 3 total (0 open, 1 in_progress, 2 done)

## Quality Gates
- npm run lint
- npm run build
- npm test

## Stories
- [done] US-001: Scaffold monorepo — Express + React Vite
- [done] US-002: SQLite schema, migrations, and FTS5 triggers (depends on: US-001)
- [in_progress] US-003: XML ingest service — parse DAM export into SQLite (depends on: US-002)

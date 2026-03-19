# PRD Overview: Royal Caribbean DAM Asset Search

- File: .agents/tasks/prd-dam-search.json
- Stories: 12 total (12 open, 0 in_progress, 0 done)

## Quality Gates
- npm run lint
- npm run build
- npm test

## Stories
- [open] US-001: Scaffold project structure
- [open] US-002: Database schema and migrations (depends on: US-001)
- [open] US-003: XML ingest service — parse DAM export into SQLite (depends on: US-002)
- [open] US-004: GET /api/assets — search and filter endpoint (depends on: US-003)
- [open] US-005: GET /api/assets/:id — asset detail endpoint (depends on: US-003)
- [open] US-006: GET /api/filters — available filter values endpoint (depends on: US-003)
- [open] US-007: POST /api/assets/upload — image upload endpoint (depends on: US-003)
- [open] US-008: POST /api/assets/:id/enrich — AI vision enrichment endpoint (depends on: US-007)
- [open] US-009: React app shell, layout, and API client (depends on: US-001)
- [open] US-010: Search and browse page (depends on: US-004, US-006, US-009)
- [open] US-011: Asset detail modal (depends on: US-005, US-010)
- [open] US-012: Upload component (depends on: US-007, US-008, US-009)

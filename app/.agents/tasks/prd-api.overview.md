# PRD Overview: Royal Caribbean DAM — API (Backend)

- File: .agents/tasks/prd-api.json
- Stories: 5 total (4 open, 1 in_progress, 0 done)

## Quality Gates
- npm run lint
- npm run build
- npm test

## Stories
- [in_progress] US-004: GET /api/assets — search and filter endpoint
- [open] US-005: GET /api/assets/:id — asset detail endpoint (depends on: US-004)
- [open] US-006: GET /api/filters — filter options endpoint (depends on: US-004)
- [open] US-007: POST /api/assets/upload — multi-file upload endpoint (depends on: US-004)
- [open] US-008: POST /api/assets/:id/enrich — OpenAI Vision enrichment endpoint (depends on: US-007)

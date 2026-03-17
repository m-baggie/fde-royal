# PRD Overview: Royal Caribbean DAM — Bulk Enrichment & Expanded Filters

- File: .agents/tasks/prd-enrichment.json
- Stories: 4 total (1 open, 1 in_progress, 2 done)

## Quality Gates
- npm run lint
- npm run build
- npm test

## Stories
- [done] US-001: Bulk enrichment CLI script
- [done] US-002: Expand /api/filters and /api/assets for channel and scene (depends on: US-001)
- [in_progress] US-003: Add Channel and Scene filter sections to FilterSidebar (depends on: US-002)
- [open] US-004: Fix dotenv path and update enrich-all script to use Anthropic (depends on: US-001)

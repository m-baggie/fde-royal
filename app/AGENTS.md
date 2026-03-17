# AGENTS.md — Royal Caribbean DAM

Operational guide for automated agents building this project.

## Project Layout

```
app/
  client/          React + Vite frontend (port 5173)
  server/          Express backend (port 3001)
  uploads/         Uploaded files — gitignored
  dam.sqlite       SQLite DB — gitignored
  .env.example     Committed env template
```

## Build & Run

```bash
# Install all workspace deps from root
npm install

# Dev (both servers)
npm run dev

# Build client only
npm run build
```

## Tests & Linting

Run these quality gates from the repo root before committing:

```bash
npm run lint    # ESLint on server/src and client/src
npm run build   # Vite production build
npm test        # Jest (server) + Vitest (client)
```

## Node Version

Node 18.x is in use. `create-vite@latest` requires Node >=20 — do NOT use it.
Scaffold the client manually or use `create-vite@5`.

## Environment

Copy `.env.example` to `.env` and fill in values.
- Missing `OPENAI_API_KEY` logs a warning but does not crash (used by server API route).
- `ANTHROPIC_API_KEY` is required by `server/scripts/enrich-all.js` — script exits 1 if not set.
- `DATA_DIR` defaults to `../Data/royal` relative to `server/`.

## Server Entry

`server/src/index.js` exports `app` and only calls `app.listen` when run as main.
This allows `supertest` to import the app without binding a port.

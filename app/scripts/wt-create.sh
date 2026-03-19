#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# wt-create.sh
#
# Run this AFTER the Foundation PRD (prd-foundation.json) has been built
# and committed on main. Creates two worktrees — one for the API (backend)
# and one for the Frontend — so Ralph can run both in parallel.
#
# Usage (from anywhere):
#   bash app/scripts/wt-create.sh
#
# Worktrees created:
#   /Users/mbaggie/Dev/FDE/Royal Caribbean-api       → feature/api
#   /Users/mbaggie/Dev/FDE/Royal Caribbean-frontend  → feature/frontend
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$REPO_ROOT/app"
API_WT="${REPO_ROOT}-api"
FE_WT="${REPO_ROOT}-frontend"
TASKS_DIR="$APP_DIR/.agents/tasks"

echo ""
echo "🔀  Royal Caribbean DAM — Worktree Setup"
echo "    Repo:     $REPO_ROOT"
echo "    API WT:   $API_WT  (feature/api)"
echo "    Front WT: $FE_WT  (feature/frontend)"
echo ""

cd "$REPO_ROOT"

# ── Sanity check: foundation must be committed ───────────────────────────────
if [ -z "$(git log --oneline main | head -1)" ]; then
  echo "❌  No commits on main. Run the Foundation PRD first, then commit."
  exit 1
fi

echo "✅  Foundation commit found: $(git log --oneline main | head -1)"
echo ""

# ── Create API worktree ───────────────────────────────────────────────────────
if [ -d "$API_WT" ]; then
  echo "⚠️   API worktree already exists at $API_WT — skipping creation."
else
  git worktree add "$API_WT" -b feature/api
  echo "✅  Created worktree: $API_WT  [feature/api]"
fi

# ── Create Frontend worktree ──────────────────────────────────────────────────
if [ -d "$FE_WT" ]; then
  echo "⚠️   Frontend worktree already exists at $FE_WT — skipping creation."
else
  git worktree add "$FE_WT" -b feature/frontend
  echo "✅  Created worktree: $FE_WT  [feature/frontend]"
fi

# ── Copy PRDs into each worktree ──────────────────────────────────────────────
echo ""
echo "📋  Copying PRDs into worktrees..."

mkdir -p "$API_WT/app/.agents/tasks"
cp "$TASKS_DIR/prd-api.json" "$API_WT/app/.agents/tasks/prd-api.json"
echo "    ✅  prd-api.json → $API_WT/app/.agents/tasks/"

mkdir -p "$FE_WT/app/.agents/tasks"
cp "$TASKS_DIR/prd-frontend.json" "$FE_WT/app/.agents/tasks/prd-frontend.json"
echo "    ✅  prd-frontend.json → $FE_WT/app/.agents/tasks/"

# ── Print next steps ──────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────────────────────"
echo "  Worktrees ready. Open two terminals and run Ralph in parallel:"
echo ""
echo "  Terminal A — Backend API:"
echo "    cd \"$API_WT/app\""
echo "    ralph build .agents/tasks/prd-api.json"
echo ""
echo "  Terminal B — Frontend:"
echo "    cd \"$FE_WT/app\""
echo "    ralph build .agents/tasks/prd-frontend.json"
echo ""
echo "  When both are done, run:  bash app/scripts/wt-teardown.sh"
echo "─────────────────────────────────────────────────────────────────────────"
echo ""

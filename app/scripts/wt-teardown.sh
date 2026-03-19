#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# wt-teardown.sh
#
# Run this after BOTH the API and Frontend PRDs have been built and committed
# in their respective worktrees. Merges feature/api and feature/frontend into
# main, removes the worktrees, and deletes the feature branches.
#
# Usage (from anywhere):
#   bash app/scripts/wt-teardown.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API_WT="${REPO_ROOT}-api"
FE_WT="${REPO_ROOT}-frontend"

echo ""
echo "🔀  Royal Caribbean DAM — Worktree Teardown"
echo "    Repo:     $REPO_ROOT"
echo "    API WT:   $API_WT"
echo "    Front WT: $FE_WT"
echo ""

cd "$REPO_ROOT"

# ── Confirm both worktrees exist ──────────────────────────────────────────────
if [ ! -d "$API_WT" ]; then
  echo "❌  API worktree not found at $API_WT"
  exit 1
fi

if [ ! -d "$FE_WT" ]; then
  echo "❌  Frontend worktree not found at $FE_WT"
  exit 1
fi

# ── Check we are on main ──────────────────────────────────────────────────────
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌  Not on main branch (currently on: $CURRENT_BRANCH)"
  echo "    Run: git checkout main"
  exit 1
fi

# ── Merge feature/api ─────────────────────────────────────────────────────────
echo "🔀  Merging feature/api into main..."
git merge --no-ff feature/api -m "Merge feature/api — Express API endpoints (US-004 to US-008)"
echo "✅  feature/api merged"

# ── Merge feature/frontend ────────────────────────────────────────────────────
echo ""
echo "🔀  Merging feature/frontend into main..."
git merge --no-ff feature/frontend -m "Merge feature/frontend — React UI (US-009 to US-012)"
echo "✅  feature/frontend merged"

# ── Remove worktrees ──────────────────────────────────────────────────────────
echo ""
echo "🗑️   Removing worktrees..."

git worktree remove "$API_WT" --force
echo "    ✅  Removed $API_WT"

git worktree remove "$FE_WT" --force
echo "    ✅  Removed $FE_WT"

# ── Delete feature branches ───────────────────────────────────────────────────
echo ""
echo "🗑️   Deleting feature branches..."

git branch -d feature/api
echo "    ✅  Deleted feature/api"

git branch -d feature/frontend
echo "    ✅  Deleted feature/frontend"

# ── Final status ──────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────────────────────"
echo "  ✅  All done. Full app is merged on main."
echo ""
echo "  Start the app:"
echo "    cd \"$REPO_ROOT/app\""
echo "    npm run dev"
echo ""
echo "  Run tests:"
echo "    npm test"
echo "─────────────────────────────────────────────────────────────────────────"
echo ""

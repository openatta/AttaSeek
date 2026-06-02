#!/usr/bin/env bash
set -euo pipefail

# ── AttaSeek Pre-commit / CI Check ─────────────────────────────────
# Runs: typecheck → tests → build.  Exits non-zero on first failure.
#
# Usage: ./scripts/check.sh
# ────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "→ $*"; }
ok()    { echo -e "  ✓ $*"; }
fail()  { echo -e "  ✗ $*"; }

PASS=0
FAIL=0

check() {
  local label="$1" cmd="$2"
  step "$label"
  if eval "$cmd" &>/dev/null; then
    ok "$label"
    ((PASS++))
  else
    fail "$label — run manually: $cmd"
    ((FAIL++))
  fi
}

echo ""
echo "══ AttaSeek Pre-Flight Check ══"
echo ""

check "Typecheck (node)"       "npx tsc --noEmit -p tsconfig.node.json"
check "Typecheck (web)"        "npx tsc --noEmit -p tsconfig.web.json"
check "Unit tests"             "npx vitest run"
check "Build"                  "npx electron-vite build"

echo ""
echo "───────"
echo -e "  ${GREEN}passed:${NC} $PASS  ${RED}failed:${NC} $FAIL"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1

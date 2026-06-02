#!/usr/bin/env bash
set -euo pipefail

# ── AttaSeek Dev Launcher ──────────────────────────────────────────
# Usage: ./scripts/dev.sh [--check]
#
#   (no args)    Launch Electron in dev mode (Vite HMR + hot restart)
#   --check      Run typecheck + tests + build, then launch if all pass
#
# Env vars:
#   ELECTRON_MIRROR   Override Electron download mirror
#   SKIP_CHECK        Set to 1 to skip the pre-launch check
# ────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

step()  { echo -e "${CYAN}→${NC} $*"; }
ok()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail()  { echo -e "  ${RED}✗${NC} $*"; }
header(){ echo -e "\n${BOLD}══ $* ══${NC}"; }

# ── Parse args ─────────────────────────────────────────────────────
DO_CHECK=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) DO_CHECK=true; shift ;;
    *) echo "Usage: $0 [--check]"; exit 1 ;;
  esac
done

# ── Node.js check ───────────────────────────────────────────────────
header "AttaSeek Dev Launcher"
echo ""

if ! command -v node &>/dev/null; then
  echo -e "${RED}Error:${NC} Node.js is not installed. Install it from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
step "Node ${NODE_VERSION} / npm ${NPM_VERSION}"

# ── Dependencies check ──────────────────────────────────────────────
if [[ ! -d node_modules ]]; then
  step "Installing dependencies..."
  npm install --legacy-peer-deps
  ok "Dependencies installed"
else
  ok "node_modules exists"
fi

# ── Electron binary check ───────────────────────────────────────────
ELECTRON_DIST="node_modules/electron/dist"
if [[ ! -d "$ELECTRON_DIST" ]]; then
  warn "Electron binary not found — re-running install"
  npm install --legacy-peer-deps
fi

if [[ -d "$ELECTRON_DIST" ]]; then
  ELECTRON_APP=""
  [[ -d "$ELECTRON_DIST/Electron.app" ]] && ELECTRON_APP="$ELECTRON_DIST/Electron.app"
  [[ -f "$ELECTRON_DIST/electron" ]] && ELECTRON_APP="$ELECTRON_DIST/electron"
  [[ -n "$ELECTRON_APP" ]] && ok "Electron binary ready" || warn "Electron: unexpected layout"
fi

# ── Pre-launch check ────────────────────────────────────────────────
if [[ "$DO_CHECK" == true && "${SKIP_CHECK:-0}" != "1" ]]; then
  header "Pre-launch checks"

  step "Typecheck (node)..."
  if npx tsc --noEmit -p tsconfig.node.json 2>&1; then
    ok "Typecheck (node) passed"
  else
    fail "Typecheck (node) failed — fix and retry"
    exit 1
  fi

  step "Typecheck (web)..."
  if npx tsc --noEmit -p tsconfig.web.json 2>&1; then
    ok "Typecheck (web) passed"
  else
    fail "Typecheck (web) failed — fix and retry"
    exit 1
  fi

  step "Unit tests..."
  if npx vitest run 2>&1; then
    ok "Tests passed"
  else
    fail "Tests failed — fix and retry"
    exit 1
  fi

  step "Build..."
  if npx electron-vite build 2>&1; then
    ok "Build passed"
  else
    fail "Build failed — fix and retry"
    exit 1
  fi

  echo ""
  echo -e "${GREEN}${BOLD}All checks passed ✓${NC}"
  echo ""
fi

# ── Launch ──────────────────────────────────────────────────────────
header "Launching Electron"
echo ""

if [[ -n "${ELECTRON_MIRROR:-}" ]]; then
  step "Electron mirror: ${ELECTRON_MIRROR}"
fi

step "Renderer dev server → http://localhost:5173/"
echo -e "  ${YELLOW}HMR active${NC} — renderer changes apply instantly"
echo -e "  ${YELLOW}Hot restart${NC} — main/preload changes restart Electron"
echo ""

npx electron-vite dev

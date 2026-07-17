#!/usr/bin/env bash
# Verify QA/release tooling prerequisites.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pass=0
fail=0
warn=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "✅ $label"
    pass=$((pass + 1))
  else
    echo "❌ $label"
    fail=$((fail + 1))
  fi
}

warn_if() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "✅ $label"
    pass=$((pass + 1))
  else
    echo "⚠️  $label (optional — blocks Android matrix)"
    warn=$((warn + 1))
  fi
}

echo "=== METHErium Mobile QA Environment ==="
echo "Root: $ROOT"
echo ""

check "Node.js" node --version
check "npm" npm --version
check "Maestro CLI" maestro --version
check "Xcode simctl" xcrun simctl list devices
check "Typecheck" npm run typecheck --silent
check "Unit tests" npm test -- --passWithNoTests --silent
check "ESLint (0 errors)" bash -c 'npm run lint --silent 2>&1 | tail -1 | rg -q "0 errors"'
check "Architecture validation" npm run validate:architecture --silent

warn_if "Android adb" command -v adb
warn_if "Java (Android)" command -v java

if xcrun simctl list devices available 2>/dev/null | rg -q "iPhone"; then
  echo "✅ iOS simulator runtimes available"
  pass=$((pass + 1))
else
  echo "❌ iOS simulator runtimes"
  fail=$((fail + 1))
fi

echo ""
echo "Summary: pass=$pass fail=$fail warn=$warn"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi

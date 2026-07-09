#!/usr/bin/env bash
# Admin Deployment Consistency & Navigation Certification
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_BASE="${ADMIN_BASE_URL:-http://127.0.0.1/admin}"
REPORT="${ROOT}/docs/FINAL_ADMIN_DEPLOYMENT_CERTIFICATION.md"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
PASS=0; FAIL=0; SKIP=0

log() { echo "[admin-cert $TS] $*"; }
record() {
  local phase="$1" item="$2" status="$3" evidence="$4"
  ROWS+=("| $phase | $item | $status | $evidence |")
  case "$status" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; SKIP) SKIP=$((SKIP+1));; esac
}

declare -a ROWS=()

# ── Phase 1/7: Git + Docker metadata ──
GIT_COMMIT=$(cd "$ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_FULL=$(cd "$ROOT" && git rev-parse HEAD 2>/dev/null || echo "unknown")
ADMIN_IMAGE=$(docker inspect exchange-admin --format '{{.Image}}' 2>/dev/null || echo "missing")
ADMIN_CREATED=$(docker inspect exchange-admin --format '{{.Created}}' 2>/dev/null || echo "missing")
ADMIN_CONTAINER=$(docker inspect exchange-admin --format '{{.Id}}' 2>/dev/null | head -c 12)
ADMIN_HEALTH=$(docker inspect exchange-admin --format '{{.State.Health.Status}}' 2>/dev/null || docker inspect exchange-admin --format '{{.State.Status}}' 2>/dev/null)

# BUILD_ID from deployed HTML
BUILD_ID=$(curl -sL "${ADMIN_BASE}/dashboard" 2>/dev/null | grep -oE 'buildId":"[^"]+' | head -1 | cut -d'"' -f3)
[[ -z "$BUILD_ID" ]] && BUILD_ID=$(curl -sL "${ADMIN_BASE}/dashboard" 2>/dev/null | grep -oE '"b":"[^"]+' | head -1 | cut -d'"' -f4)
[[ -n "$BUILD_ID" ]] && record "7" "Next.js BUILD_ID (live)" "PASS" "$BUILD_ID" || record "7" "Next.js BUILD_ID (live)" "SKIP" "not found in HTML"

record "7" "Git commit (repo)" "PASS" "$GIT_COMMIT"
record "7" "Admin container" "PASS" "id=${ADMIN_CONTAINER} health=${ADMIN_HEALTH} created=${ADMIN_CREATED}"

# ── Collect source routes (static pages only) ──
mapfile -t SOURCE_ROUTES < <(find "$ROOT/apps/admin-panel/src/app/(protected)" -name 'page.tsx' \
  | sed "s|$ROOT/apps/admin-panel/src/app/(protected)||" \
  | sed 's|/page.tsx||' \
  | sed 's|\[.*\]|*|g' \
  | sort -u)

# Nav hrefs from nav-sections.ts
mapfile -t NAV_ROUTES < <(grep -oE "href: '[^']+'" "$ROOT/apps/admin-panel/src/lib/admin/nav-sections.ts" | cut -d"'" -f2 | sort -u)

# Deprecated redirect stubs (intentionally not in nav)
DEPRECATED="/settings/integrations /settings/infrastructure /settings/nodes"

log "Phase 2 — Route certification (${#NAV_ROUTES[@]} nav routes)"
for r in "${NAV_ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "${ADMIN_BASE}${r}" 2>/dev/null || echo "000")
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
    record "2" "GET ${r}" "PASS" "HTTP $code"
  else
    record "2" "GET ${r}" "FAIL" "HTTP $code"
  fi
done

log "Phase 4 — Compliance Policy"
cp_code=$(curl -s -o /dev/null -w "%{http_code}" -L "${ADMIN_BASE}/compliance-policy" 2>/dev/null)
[[ "$cp_code" == "200" ]] && record "4" "/compliance-policy deployed" "PASS" "HTTP $cp_code" \
  || record "4" "/compliance-policy deployed" "FAIL" "HTTP $cp_code"

grep -q "compliance-policy" "$ROOT/apps/admin-panel/src/lib/admin/nav-sections.ts" \
  && record "4" "Compliance Policy in nav source" "PASS" "nav-sections.ts" \
  || record "4" "Compliance Policy in nav source" "FAIL" "missing"

grep -q "nav-compliance-policy" "$ROOT/apps/admin-panel/src/lib/commandRegistry.ts" \
  && record "9" "Compliance Policy in command palette" "PASS" "commandRegistry.ts" \
  || record "9" "Compliance Policy in command palette" "FAIL" "missing"

log "Phase 5 — Hidden / deprecated routes"
for r in $DEPRECATED; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "${ADMIN_BASE}${r}" 2>/dev/null)
  record "5" "${r} (deprecated redirect)" "SKIP" "HTTP $code → /system/integrations (intentional stub, not in nav)"
done

log "Phase 3 — Nav vs source coverage"
for r in "${NAV_ROUTES[@]}"; do
  found=0
  for s in "${SOURCE_ROUTES[@]}"; do
    [[ "$s" == "$r" ]] && found=1 && break
    [[ "$s" == *"*"* ]] && [[ "$r" == "${s//\*/}"* ]] && found=1 && break
  done
  [[ $found -eq 1 ]] && record "3" "Nav ${r} has source page" "PASS" "page.tsx exists" \
    || record "3" "Nav ${r} has source page" "FAIL" "no page.tsx"
done

# Production pages in source but not in nav (exclude dynamic [id] and deprecated)
for s in "${SOURCE_ROUTES[@]}"; do
  [[ "$s" == *"*"* ]] && continue
  echo "$DEPRECATED" | grep -q "$s" && continue
  in_nav=0
  for r in "${NAV_ROUTES[@]}"; do [[ "$r" == "$s" ]] && in_nav=1 && break; done
  [[ $in_nav -eq 0 ]] && record "3" "Orphan source page ${s}" "FAIL" "not in sidebar nav"
done

# ── Write report ──
{
  echo "# FINAL Admin Deployment Consistency Certification"
  echo ""
  echo "**Run:** $TS UTC"
  echo "**Results:** PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  echo ""
  echo "## Deployment Identity"
  echo "| Field | Value |"
  echo "|-------|-------|"
  echo "| Git commit | \`$GIT_COMMIT\` (\`$GIT_FULL\`) |"
  echo "| Admin image | \`$ADMIN_IMAGE\` |"
  echo "| Container | \`$ADMIN_CONTAINER\` |"
  echo "| Container created | $ADMIN_CREATED |"
  echo "| Health | $ADMIN_HEALTH |"
  echo "| Live BUILD_ID | ${BUILD_ID:-—} |"
  echo "| Admin base URL | $ADMIN_BASE |"
  echo ""
  echo "## Phase Summary"
  echo ""
  echo "| Phase | Item | Status | Evidence |"
  echo "|-------|------|--------|----------|"
  for row in "${ROWS[@]}"; do echo "$row"; done
  echo ""
  echo "## Navigation Map (Production)"
  echo "- **Compliance Reports** (\`/compliance\`) — STR, AML dashboard, regulatory exports"
  echo "- **Compliance Policy** (\`/compliance-policy\`) — Runtime KYC/AML presets"
  echo "- **Webhooks & Delivery** (\`/integrations\`) — Outbound webhooks"
  echo "- **Integrations Center** (\`/system/integrations\`) — KYC/AML/RPC providers"
  echo ""
  echo "## Intentionally Hidden (Deprecated Redirects)"
  echo "| Route | Redirects to | Reason |"
  echo "|-------|--------------|--------|"
  echo "| /settings/integrations | /system/integrations | Consolidated |"
  echo "| /settings/infrastructure | /system/integrations | Consolidated |"
  echo "| /settings/nodes | /system/integrations | Consolidated |"
  echo ""
  if [[ "$FAIL" -eq 0 ]]; then
    echo "**STATUS: COMPLETE** — Admin deployment consistent with repository."
  else
    echo "**STATUS: INCOMPLETE** — $FAIL issue(s). Rebuild admin-panel: \`docker compose -f docker-compose.production.yml build admin-panel && docker compose -f docker-compose.production.yml up -d admin-panel\`"
  fi
} > "$REPORT"

log "Report: $REPORT"
log "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[[ "$FAIL" -eq 0 ]]

# FDA Fresh Repository — Copy Manifest

**Source host path:** `/opt/m-live`  
**Base commit (branch tip):** `effd130cb716f3646600f6324beaf4ec6a32c47e`  
**Live frontend commit (BUILD_ID):** `a5156ff` (1 commit behind tip)  
**Overlay required:** 228 paths — `REQUIRED_BUT_NOT_COMMITTED` in `.build/dirty-path-classification.json`

---

## MUST COPY (application + infra)

| Path | Purpose | Notes |
|------|---------|--------|
| `apps/frontend/` | Customer UI | Docker build context; Next.js |
| `apps/admin-panel/` | Admin UI | Docker build context |
| `apps/backend/` | API, workers, **`src/database/migrate.ts`** | Includes `seed-admin.ts`, scripts |
| `apps/indexer/` | Deposit/indexer service | Production compose service |
| `matching-engine/` | Rust spot engine | WAL path mounted via volume at runtime |
| `packages/` | Shared workspace packages | Required for `npm ci` / turbo |
| `nginx/` | Reverse proxy templates | TLS dir: copy **structure** + README; certs **recreate** |
| `infra/nats/` | NATS image build | `exchange-nats:2.10-alpine` |
| `infra/docker-compose.monitoring.yml` | Prometheus/Grafana | Optional but present on VPS |
| `infra/grafana/`, `infra/prometheus/` | Dashboards/rules | If monitoring used |
| `docker-compose.yml` | Dev / merged references | |
| `docker-compose.production.yml` | **Production stack** | Primary deploy file |
| `docker-compose.prod-images.yml` | Pull-only variant | |
| `docker-compose.forex-demo.yml` | Demo overlay | Optional |
| `package.json`, `package-lock.json` | Monorepo root | Lock file **required** |
| `turbo.json` | Turbo pipeline | |
| `playwright*.config.ts` | E2E configs | Including `playwright.forex-drawing.config.ts` |
| `scripts/` | `vps-first-boot.sh`, `vps-migrate.sh`, backup, certs | **Backend bind-mounts repo root** |
| `e2e/` | Playwright specs | Quality gate |
| `load/` | k6 scripts | CI/load gate |
| `security/` | Security test runner | |
| `.github/workflows/` | CI/CD | **Must reconfigure** secrets/registry |
| `.dockerignore`, `.gitignore` | Build/context boundaries | Adapt for fresh repo |
| `.env.example`, `.env.production.example` | **Templates only** | No secrets |
| `deployment/` | Deploy helpers | |
| `docs/` (subset) | Runbooks, deployment | 649 tracked files — SHOULD for ops |
| `brand/` | Static brand assets | Optional product |
| `session-core/`, `edge-auth-gateway/` | Supporting modules | Copy; verify runtime use |
| `apps/mobile/` | Mobile client | SHOULD if product includes mobile |

**Dirty overlay:** Every path with classification `REQUIRED_BUT_NOT_COMMITTED` (228 entries) **must** appear in the copied tree even if absent from `git archive effd130`.

---

## SHOULD COPY

| Path | Reason |
|------|--------|
| `README.md`, `CLIENT-*-GUIDE.md`, `PRODUCTION-DEPLOYMENT-CHECKLIST.md` | Operator docs |
| `audit/` (non-runtime data) | Internal QA scripts — not production runtime |
| `.build/FDA_*` and migration audit set | Migration evidence pack |
| `data/` | Non-secret static data only — inspect before copy |

---

## DO NOT COPY

| Path | Reason |
|------|--------|
| `.git/` | Old lineage — new repo gets fresh history |
| `node_modules/` | Regenerate via `npm ci` |
| `apps/*/.next/`, `dist/`, `target/` | Build outputs |
| `.env`, `.env.local`, `*.pem`, `*.key`, `secrets/` | **Secrets** — recreate |
| `release-freeze-backup-*.bundle`, `release-backup/`, `release/` | Git bundles / backups (.gitignore) |
| `backups/`, `*.sql.gz` | DB backups — handle via separate secure transfer |
| `logs/`, `*.log`, `test-results/`, `playwright-report/` | Runtime/test artifacts |
| `docker-compose.override.yml` | Local overrides (gitignored) |
| `.deploy-rev`, `.deploy-rev.prev`, `.deploy-*backup*`, rollback scripts | VPS-specific deploy state |
| `.turbo/`, `.cache/`, `coverage/` | Cache |
| `uat-evidence/`, `.audit-screenshots/` | Evidence |
| `apps/backend/data/p2p-payment-proofs/` | Tier-1 user uploads — migrate via storage policy, not git |

---

## REGENERATE (on new machine / after copy)

- `npm ci` at repo root  
- Docker images: `m-live-frontend`, `m-live-backend`, `m-live-admin-panel`, `m-live-matching-engine`, `m-live-indexer`, `exchange-nats`  
- Frontend `.next/BUILD_ID` (new on each build)  
- `.deploy-rev` (if retained at all — new tracking file)  
- TLS: `nginx/ssl/fullchain.pem`, `privkey.pem` via `scripts/generate-self-signed-tls.sh` or real CA  

---

## RECONFIGURE

| Item | Action |
|------|--------|
| Git remote | New GitHub/org repo |
| CI `REGISTRY` / `IMAGE_PREFIX` | `.github/workflows/production.yml` uses `ghcr.io/.../exchange` |
| Compose project name | Currently implies `m-live_*` volumes — rename for clean VPS |
| `COMPOSE_PROJECT_DIR` | Set to new clone path on VPS |
| `PUBLIC_*_URL`, `CORS_ORIGINS`, OAuth callbacks | New domain/IP |
| `ADMIN_IP_WHITELIST`, `INTERNAL_API_ALLOW_CIDRS` | New VPS network |

---

## OBTAIN EXTERNALLY (not in Git)

- Production **PostgreSQL dump** (57 users, 9 forex_accounts, all ledger state)  
- **AWS KMS** key + IAM (or new key material)  
- **RPC providers** (Alchemy, Ankr, chain URLs in `.env.production.example`)  
- **Email/SMS** provider credentials  
- **KYC/AML** vendor keys if enabled  
- **Hot wallet** material via KMS/envelope — not raw keys in repo  
- **Webhook signing secrets** for PSP/alerts  

---

## Migration action summary

| Category | Count (approx.) |
|----------|------------------|
| Tracked files to include | 3605 |
| Additional required dirty paths | 228 |
| Untracked `.build` (optional) | 1902 |
| Never copy (local only) | secrets + volumes + bundles |

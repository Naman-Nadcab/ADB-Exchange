# Cleanup Report

**Generated:** 2026-06-23  
**Action:** Non-production artifact removal for m-live packaging

## Removed from working tree

| Path | Type | Approx. size | Reason |
|------|------|--------------|--------|
| `audit/interactive/screenshots/` | PNG | ~15 MB | Playwright interactive audit captures |
| `audit/ui-forensic/screenshots/` | PNG | ~5 MB | UI forensic crawl screenshots |
| `audit/screenshots/` | PNG | ~4 MB | Wallet UX audit captures |
| `audit-artifacts/` | JSON/logs | ~5.2 MB | Tier-1 readiness sampler output |
| `backups/*.sql.gz` | DB dump | (if present) | Local database snapshot |

**Total PNG files removed:** ~518

## Added to `.gitignore` (not shipped)

- `audit/**/screenshots/`
- `audit-artifacts/`
- `backups/`
- `*.sql.gz`
- `provider-secrets.json`
- `audit/interactive/data/`
- `audit/ui-forensic/data/`
- Interactive/forensic audit runner scripts
- `.exchange/` (local engine WAL)

## Preserved (production-relevant)

| Path | Reason |
|------|--------|
| `apps/**` | Application source |
| `matching-engine/**` | Rust matcher |
| `nginx/**` | Production proxy |
| `docker-compose*.yml` | Orchestration |
| `.env.example`, `.env.production.example` | Config templates |
| `scripts/backup-db.sh`, `smoke-api.mjs`, release gates | Ops |
| `docs/**` | Runbooks (large but operational) |
| `audit/*.md` (top-level reports) | Historical audit summaries (text only) |

## Added for production

| File | Purpose |
|------|---------|
| `.dockerignore` | Smaller Docker build context |
| `backups/provider-secrets.template.json` | Secret backup structure |
| `.github/workflows/production.yml` | CI/CD pipeline |
| `docs/VPS_DEPLOYMENT.md` | Deploy runbook |
| `docs/GO_LIVE_CHECKLIST.md` | Launch checklist |

## Not deleted (flagged only)

- `e2e/`, `load/`, `security/` — needed for CI gates; not deployed to VPS runtime
- `scripts/ui-forensic-*.mjs`, `interactive-*.mjs` — gitignored but may exist locally
- Root `*_AUDIT*.md` scratch files — review manually if still present

## Repository cleanliness after cleanup

| Metric | Before | After |
|--------|--------|-------|
| Audit PNG artifacts | ~518 files | 0 |
| audit-artifacts | present | removed |
| Docker context bloat | unbounded | `.dockerignore` added |
| Secrets in tree | none found | template + gitignore hardened |

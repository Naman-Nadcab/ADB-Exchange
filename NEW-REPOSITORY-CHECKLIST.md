# New Repository Migration Checklist

Use this checklist when creating a **brand-new Git repository** for client distribution. The new repo must have **zero dependency** on the current development VPS.

---

## Pre-Migration

- [ ] Complete `RELEASE-AUDIT.md` review
- [ ] Confirm exchange is functionally frozen (no feature work in release branch)
- [ ] Tag release version in source repo (e.g. `v1.0.0-product`)
- [ ] Export clean tarball or use `git archive` (no history)

---

## What the New Repository MUST Contain

- [ ] `apps/` — frontend, admin-panel, backend, indexer, mobile (optional)
- [ ] `matching-engine/`, `session-core/`, `packages/`
- [ ] `infra/` — NATS, Prometheus, Grafana configs
- [ ] `nginx/` — reverse proxy configs
- [ ] `docker-compose.yml`, `docker-compose.production.yml`, `docker-compose.prod-images.yml`
- [ ] `deployment/` — install, deploy, update, rollback, backup, restore, verify scripts
- [ ] `.env.example`, `.env.production.example`
- [ ] `CLIENT-*.md` guides and `PRODUCTION-DEPLOYMENT-CHECKLIST.md`
- [ ] `RELEASE-CERTIFICATION.md`, `RELEASE-AUDIT.md`
- [ ] `package.json`, `turbo.json`, `package-lock.json`
- [ ] `.github/workflows/` — CI workflows (update deploy secrets per client)
- [ ] `docs/architecture-diagrams/` (optional product documentation)
- [ ] Root `README.md` — product overview + quick start

---

## What the New Repository MUST NOT Contain

### Git history & branches
- [ ] No `.git/` from development repo (start fresh: `git init`)
- [ ] No `release/exchange-production-baseline` or experimental branch history
- [ ] No merge commits referencing internal VPS commits

### Secrets & credentials
- [ ] No `.env`, `.env.local`, `apps/backend/.env`
- [ ] No `e2e/.e2e-credentials.json`
- [ ] No `nginx/ssl/*.pem` (generate on client VPS)
- [ ] No `release-backup/.env.production.backup`
- [ ] No `provider-secrets.json`

### Development / VPS artifacts
- [ ] No `release-backup/` directory
- [ ] No `*.bundle` git bundles
- [ ] No `audit/*.log`, `audit/final-cert-*.log`
- [ ] No `backups/*.sql.gz`
- [ ] No `playwright-report/`, `test-results/`
- [ ] No `.deploy-rev`, `.deploy-rev.prev`
- [ ] No root-level forensic audit markdown (64+ files) — optional: move subset to `docs/internal/`

### Machine-specific configuration
- [ ] No hardcoded VPS IP (`109.123.254.30`) in scripts — use `PUBLIC_HOST` env
- [ ] No `/opt/m-live` paths in committed scripts (use `COMPOSE_PROJECT_DIR` or relative paths)
- [ ] No personal SSH keys, `.cursor/`, IDE settings
- [ ] No `docs/verification-admin-sweep/` with captured production URLs (optional exclude)

### CI artifacts
- [ ] No uploaded workflow artifacts in repo tree
- [ ] No `node_modules/` (client runs `npm ci` if building locally; Docker build preferred)

---

## Recommended Export Procedure

```bash
# On release machine — clean export without git history
git archive --format=tar.gz --prefix=exchange-product/ v1.0.0-product -o exchange-product.tar.gz

# Or rsync with exclusions
rsync -a --exclude node_modules --exclude .git --exclude release-backup \
  --exclude audit --exclude '*.bundle' --exclude .env \
  /opt/m-live/ /tmp/exchange-product/

cd /tmp/exchange-product
git init
git add .
git commit -m "Initial product release v1.0.0"
```

---

## Post-Migration Validation

- [ ] `grep -r "109.123.254.30" .` returns zero matches (or docs only)
- [ ] `grep -r "/opt/m-live" apps/ deployment/ scripts/vps*.sh` — parameterize or document
- [ ] `find . -name "*.env" ! -name "*.example" | wc -l` → 0
- [ ] `bash deployment/install.sh` succeeds on fresh Ubuntu VM
- [ ] `cp .env.production.example .env` + fill secrets + `bash deployment/deploy.sh` succeeds
- [ ] `bash deployment/verify.sh` passes
- [ ] `RELEASE-CERTIFICATION.md` verdict: READY FOR NEW REPOSITORY

---

## Client Repository Naming

Suggested: `exchange-platform`, `digital-asset-exchange`, or client-branded name.

Default install path on client VPS: `/opt/exchange` (document in `CLIENT-INSTALLATION-GUIDE.md`).

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Release Engineering | | | |
| Security | | | |
| Client Delivery | | | |

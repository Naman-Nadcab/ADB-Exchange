# Client Upgrade Guide

Upgrade the exchange to a new product version on a client VPS.

---

## Pre-Upgrade Checklist

- [ ] Read release notes for target version
- [ ] Schedule maintenance window (if required)
- [ ] Run backup: `bash deployment/backup.sh`
- [ ] Save current revision: `git rev-parse HEAD > .deploy-rev`
- [ ] Verify health: `bash deployment/health-check.sh`
- [ ] Notify users (if maintenance mode needed)

---

## Standard Upgrade

```bash
cd /opt/exchange
bash deployment/update.sh
```

This will:

1. Save previous commit to `.deploy-rev.prev`
2. `git pull --ff-only` (or checkout specified tag)
3. Run migrations
4. Rebuild and restart containers
5. Run health checks

---

## Upgrade to Specific Version

```bash
bash deployment/update.sh v1.1.0
```

---

## Zero-Downtime Considerations

Single-node Docker Compose deployments experience brief restarts during upgrade.

For minimal user impact:

1. Enable maintenance mode in `.env` (optional)
2. Halt trading: `bash scripts/vps-trading-halt.sh halt`
3. Run upgrade
4. Verify: `bash deployment/verify.sh`
5. Resume trading: `bash scripts/vps-trading-halt.sh resume`
6. Disable maintenance mode

---

## Database Migrations

Migrations run automatically during `deployment/deploy.sh` via:

```bash
docker compose -f docker-compose.production.yml --profile tools run --rm migrate
```

If migration fails:

1. Check logs: `docker compose -f docker-compose.production.yml logs migrate`
2. Do **not** force partial state — restore from backup if needed
3. Contact support with migration error output

---

## Rollback After Failed Upgrade

```bash
bash deployment/rollback.sh
```

Or restore database from pre-upgrade backup if schema changed:

```bash
bash deployment/restore.sh ./backups/exchange_db_<pre-upgrade>.sql.gz
bash deployment/rollback.sh
```

---

## Environment Variable Changes

When release notes list new `.env` variables:

1. Compare: `diff .env.production.example .env`
2. Add new variables to `.env`
3. Redeploy: `bash deployment/deploy.sh`

---

## Image-Only Upgrade (CI/CD)

If using pre-built GHCR images:

```bash
docker compose -f docker-compose.production.yml \
  -f docker-compose.prod-images.yml pull
SKIP_BUILD=1 bash deployment/deploy.sh
```

Set `IMAGE_PREFIX` in environment or `.env` per CI documentation.

---

## Post-Upgrade Verification

```bash
bash deployment/verify.sh
curl -sf "https://$(grep PUBLIC_HOST .env | cut -d= -f2)/api/v1/spot/markets" | head -c 200
```

Monitor for 30 minutes:

- Grafana dashboards
- Settlement pending = 0
- Error rate in backend logs

---

## Version Matrix

Maintain a client-specific version log:

| Date | Version | Commit | Operator | Notes |
|------|---------|--------|----------|-------|
| | | | | |

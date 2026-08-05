# Deployment Package

Automated installation and operations for client VPS deployments.

## Quick Start

```bash
sudo bash deployment/install.sh          # once per fresh VPS
cp .env.production.example .env          # fill all CHANGE_ME values
bash deployment/deploy.sh                # first deploy
bash deployment/verify.sh                # confirm health
```

## Scripts

| Script | Purpose |
|--------|---------|
| `install.sh` | Install Docker, Compose, Git on Ubuntu |
| `deploy.sh` | Full stack deploy (TLS, infra, migrate, build, seed, monitoring) |
| `update.sh` | Pull/update code, migrate, rebuild |
| `rollback.sh` | Roll back to previous git revision |
| `backup.sh` | PostgreSQL backup to `./backups/` |
| `restore.sh` | Restore database from `.sql.gz` |
| `health-check.sh` | HTTP health probes via nginx |
| `verify.sh` | Health + container + Prometheus checks |
| `ssl.sh` | Self-signed TLS for first boot |
| `firewall.sh` | UFW rules (80, 443, SSH) |

## Documentation

- [`requirements.md`](requirements.md) — server requirements
- [`../CLIENT-INSTALLATION-GUIDE.md`](../CLIENT-INSTALLATION-GUIDE.md) — full install guide
- [`../CLIENT-OPERATIONS-GUIDE.md`](../CLIENT-OPERATIONS-GUIDE.md) — day-to-day ops
- [`../NEW-REPOSITORY-CHECKLIST.md`](../NEW-REPOSITORY-CHECKLIST.md) — new repo export

## Options

Environment variables for `deploy.sh`:

- `SKIP_TLS=1` — skip certificate generation
- `SKIP_BUILD=1` — use existing images
- `SKIP_MIGRATE=1` — skip migrations
- `SKIP_SEED=1` — skip admin seed
- `SKIP_MONITORING=1` — skip Prometheus/Grafana

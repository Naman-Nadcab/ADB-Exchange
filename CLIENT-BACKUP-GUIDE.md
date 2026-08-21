# Client Backup Guide

Backup and restore procedures for the Enterprise Digital Asset Exchange.

---

## What to Back Up

| Asset | Method | Frequency |
|-------|--------|-----------|
| PostgreSQL database | `deployment/backup.sh` | Daily (minimum) |
| `.env` file | Secure secrets vault | On every change |
| `nginx/ssl/` certificates | Copy to secure storage | On renewal |
| Matching engine WAL volume | Docker volume snapshot | Daily (optional) |
| Grafana dashboards | Provisioned in repo | Version controlled |

---

## Database Backup

### Manual backup

```bash
cd /opt/exchange
bash deployment/backup.sh
```

Output: `./backups/exchange_db_YYYYMMDD_HHMMSS.sql.gz`

### Scheduled backup (cron)

```bash
crontab -e
```

Add:

```
0 2 * * * cd /opt/exchange && bash deployment/backup.sh /var/backups/exchange >> /var/log/exchange-backup.log 2>&1
```

### Off-site copy

```bash
scp /var/backups/exchange/exchange_db_*.sql.gz user@backup-host:/backups/exchange/
```

Or use S3/rsync/rclone per your infrastructure policy.

---

## Database Restore

**Warning:** Overwrites current database. Halt trading first.

```bash
cd /opt/exchange
bash scripts/vps-trading-halt.sh halt
bash deployment/restore.sh /path/to/exchange_db_YYYYMMDD_HHMMSS.sql.gz
bash deployment/deploy.sh
bash scripts/vps-trading-halt.sh resume
```

---

## Environment Backup

Store `.env` in encrypted secrets manager (HashiCorp Vault, AWS Secrets Manager, 1Password):

```bash
gpg -c .env   # ad-hoc encrypted copy — use proper vault in production
```

Never store `.env` in git or unencrypted cloud storage.

---

## Disaster Recovery

### Full VPS loss

1. Provision new Ubuntu VPS (same spec or larger)
2. `sudo bash deployment/install.sh`
3. Clone product repository
4. Restore `.env` from secrets vault
5. Restore TLS certs to `nginx/ssl/` (or regenerate with `deployment/ssl.sh`)
6. `bash deployment/deploy.sh` (starts empty DB)
7. `bash deployment/restore.sh <latest-backup.sql.gz>`
8. `bash deployment/verify.sh`

**RTO target:** 2–4 hours (depends on backup size and image build time)  
**RPO target:** Last scheduled backup (recommend ≤24 hours)

---

## Backup Verification

Monthly restore drill on staging:

1. Restore backup to staging VPS
2. Run `bash deployment/verify.sh`
3. Confirm spot markets API and admin login work
4. Document result in change log

---

## Retention Policy

| Tier | Retention | Storage |
|------|-----------|---------|
| Daily | 7 days | Local + off-site |
| Weekly | 4 weeks | Off-site |
| Monthly | 12 months | Off-site cold storage |

Adjust per regulatory requirements.

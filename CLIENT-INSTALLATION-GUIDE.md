# Client Installation Guide

Install the Enterprise Digital Asset Exchange on a **fresh Ubuntu VPS** with no dependency on any prior server.

---

## Overview

| Step | Command | When |
|------|---------|------|
| 1 | Host prerequisites | Once per VPS |
| 2 | Clone repository | Once per VPS |
| 3 | Configure environment | Once per VPS |
| 4 | Deploy stack | First deploy + updates |
| 5 | Verify | After every deploy |

**Total manual steps:** 5. No manual Docker commands, migrations, or SSL steps required beyond the scripts below.

---

## Requirements

See [`deployment/requirements.md`](deployment/requirements.md):

- Ubuntu 22.04 or 24.04 LTS
- 4+ vCPU, 16+ GB RAM, 100+ GB SSD
- AWS KMS access (production hot wallet encryption)
- Public IPv4 (or domain)

---

## Step 1 — Install Host Prerequisites

```bash
sudo bash deployment/install.sh
```

Installs Docker, Docker Compose plugin, Git, and base tools.

If using a non-root deploy user, log out and back in after install (docker group).

---

## Step 2 — Clone Repository

```bash
sudo mkdir -p /opt/exchange
sudo chown "$USER":"$USER" /opt/exchange
git clone <YOUR_PRODUCT_REPOSITORY_URL> /opt/exchange
cd /opt/exchange
```

---

## Step 3 — Configure Environment

```bash
cp .env.production.example .env
nano .env   # or your preferred editor
```

**Required:** Replace every `CHANGE_ME` value. Minimum:

| Variable | Description |
|----------|-------------|
| `PUBLIC_HOST` | Server public IP or domain |
| `POSTGRES_PASSWORD` | Strong database password |
| `RABBITMQ_PASSWORD` | Strong message broker password |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ≥32 random characters each |
| `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` | ≥32 random characters each |
| `ENGINE_HMAC_SECRET`, `ENGINE_INTERNAL_SECRET` | Engine/backend shared secrets |
| `INTERNAL_HMAC_SERVICE_SECRETS` | `matching-engine=<same as ENGINE_HMAC_SECRET>` |
| `ADMIN_IP_WHITELIST` | Your operator IP, e.g. `203.0.113.10/32` |
| `AWS_KMS_KEY_ID`, `AWS_REGION` | KMS for wallet encryption |
| `AWS_ACCESS_KEY_ID` / instance role | KMS access |

Generate secrets:

```bash
openssl rand -hex 32
```

---

## Step 4 — Deploy

```bash
bash deployment/deploy.sh
```

This automatically:

1. Generates self-signed TLS (or uses existing certs in `nginx/ssl/`)
2. Starts PostgreSQL, Redis, RabbitMQ, NATS
3. Runs database migrations
4. Builds and starts all application containers
5. Seeds initial admin users
6. Starts Prometheus + Grafana (monitoring)
7. Runs health checks

**Duration:** 15–30 minutes on first deploy (image build).

---

## Step 5 — Verify

```bash
bash deployment/verify.sh
```

Expected: all health checks **PASS**.

---

## Access URLs

Replace `PUBLIC_HOST` with your configured value:

| Surface | URL |
|---------|-----|
| User exchange | `https://PUBLIC_HOST/` |
| Admin panel | `https://PUBLIC_HOST/admin` |
| API | `https://PUBLIC_HOST/api/v1/` |
| Grafana | `http://PUBLIC_HOST:3001` (restrict firewall) |

---

## Post-Install (Required Before Public Launch)

1. **Change admin passwords** — default seed credentials are in backend seed script; change immediately.
2. **Configure SMTP/SMS** — Admin → Integrations (user OTP).
3. **Configure blockchain RPC** — Admin → Chains / Integrations.
4. **Provision hot wallets** — `bash scripts/provision-hot-wallets.sh` (after KMS verified).
5. **Enable admin 2FA** — set `ADMIN_2FA_MANDATORY=true` in `.env`, redeploy.
6. **Configure sanctions provider** — required for P2P (`SANCTIONS_PROVIDER`, `SANCTIONS_API_KEY`).
7. **Schedule backups** — cron: `0 2 * * * /opt/exchange/deployment/backup.sh`

---

## Optional — Firewall

```bash
sudo bash deployment/firewall.sh
```

---

## Optional — Let's Encrypt

When a domain is configured:

1. Update `PUBLIC_HOST` and `PUBLIC_*` URLs in `.env`
2. Obtain certificates (Certbot) and place in `nginx/ssl/fullchain.pem` + `privkey.pem`
3. Run `bash deployment/deploy.sh`

---

## Troubleshooting

See [`CLIENT-TROUBLESHOOTING.md`](CLIENT-TROUBLESHOOTING.md).

---

## Support Escalation

Collect before contacting support:

```bash
bash deployment/verify.sh 2>&1 | tee verify.log
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs backend --tail 100
```

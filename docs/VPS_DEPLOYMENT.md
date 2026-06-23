# VPS Deployment Guide

**Generated:** 2026-06-23  
**Target:** Ubuntu 22.04/24.04 LTS, single-node Docker Compose

## 1. Server provisioning

| Spec | Minimum | Recommended |
|------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 200 GB NVMe |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |

## 2. Initial setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw fail2ban

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Compose plugin
sudo apt install -y docker-compose-plugin
```

## 3. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Restrict admin API: set `ADMIN_IP_WHITELIST` — do not expose backend :4000 publicly (nginx only).

## 4. Clone repository

```bash
sudo mkdir -p /opt/exchange
sudo chown $USER:$USER /opt/exchange
git clone https://github.com/Naman-Nadcab/m-live.git /opt/exchange
cd /opt/exchange
```

## 5. Environment

```bash
cp .env.production.example .env
nano .env   # fill all secrets — see docs/ENV_SETUP.md
chmod 600 .env
```

## 6. TLS certificates

### Option A: Let's Encrypt (certbot on host)

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com -d admin.yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
```

### Option B: Purchased certs

Place `fullchain.pem` and `privkey.pem` in `nginx/ssl/` per `nginx/ssl/README.md`.

## 7. Database migration

```bash
docker compose -f docker-compose.production.yml up -d postgres redis
sleep 10
docker compose -f docker-compose.production.yml run --rm backend npm run migrate
```

Or from host if `DATABASE_URL` points to exposed postgres (not recommended in prod).

## 8. Admin seed

```bash
docker compose -f docker-compose.production.yml run --rm backend npx tsx seed-admin.ts
# Login → change password → enable 2FA
```

## 9. Start stack

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
curl -s http://127.0.0.1/health/live
```

## 10. DNS

| Record | Points to |
|--------|-----------|
| `yourdomain.com` | VPS IP |
| `api.yourdomain.com` | VPS IP (or same nginx) |
| `admin.yourdomain.com` | VPS IP |

Update `PUBLIC_API_URL`, `CORS_ORIGINS`, OAuth callbacks in `.env`.

## 11. CI/CD deploy (GitHub Actions)

Configure repository secrets:

- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- `VPS_DEPLOY_PATH=/opt/exchange`
- `PUBLIC_HEALTH_URL=https://api.yourdomain.com`

Push to `main` triggers `.github/workflows/production.yml`.

### Manual rollback

GitHub → Actions → Production → Run workflow → set `rollback_image_tag` to previous SHA.

## 12. Monitoring (optional)

```bash
docker compose -f infra/docker-compose.monitoring.yml up -d
# Grafana :3001 — restrict via firewall/VPN
```

## 13. Backups

```bash
# Cron daily
0 3 * * * /opt/exchange/scripts/backup-db.sh
```

Store backups off-server; never commit `*.sql.gz`.

## 14. Post-deploy smoke

```bash
curl -sf https://api.yourdomain.com/health/live
curl -sf https://yourdomain.com/login -o /dev/null -w '%{http_code}\n'
```

See `docs/GO_LIVE_CHECKLIST.md`.

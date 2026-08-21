# Client Troubleshooting

Common issues and resolutions for client VPS deployments.

---

## Deployment Fails at Step 1 (TLS)

**Symptom:** `deployment/ssl.sh` exits with missing host.

**Fix:**
```bash
# Ensure PUBLIC_HOST is set in .env
grep PUBLIC_HOST .env
bash deployment/ssl.sh your.server.ip.or.domain
```

Or skip TLS for initial HTTP test: `SKIP_TLS=1 bash deployment/deploy.sh`

---

## Backend Not Healthy

**Symptom:** `Backend did not become healthy` after 6 minutes.

**Diagnose:**
```bash
docker compose -f docker-compose.production.yml logs backend --tail 150
```

**Common causes:**

| Log message | Fix |
|-------------|-----|
| `POSTGRES_PASSWORD required` | Fill `.env` secrets |
| `KMS startup probe failed` | Verify AWS credentials and `AWS_KMS_KEY_ID` |
| `ENGINE_HMAC_SECRET required` | Set engine secrets in `.env` |
| `Redis connection refused` | Wait for infra; check `docker compose ps redis` |
| `STRICT_DEPENDENCY_STARTUP` | Ensure NATS/RabbitMQ healthy before backend |

---

## 502 Bad Gateway (Nginx)

**Diagnose:**
```bash
docker compose -f docker-compose.production.yml ps frontend admin backend
docker compose -f docker-compose.production.yml logs nginx --tail 50
```

**Fix:** Restart unhealthy upstream:
```bash
docker compose -f docker-compose.production.yml restart backend frontend admin
```

---

## Database Migration Failed

```bash
docker compose -f docker-compose.production.yml --profile tools run --rm migrate
```

If corrupted, restore from backup (see `CLIENT-BACKUP-GUIDE.md`).

---

## Admin Login 403 / Blocked

**Cause:** `ADMIN_IP_WHITELIST` does not include your IP.

**Fix:**
```bash
# Add your IP to .env
ADMIN_IP_WHITELIST=YOUR.IP.ADDRESS/32,127.0.0.1
docker compose -f docker-compose.production.yml up -d backend
```

---

## P2P / Sanctions Blocked

**Symptom:** P2P sell ads fail; logs show sanctions fail-closed.

**Fix:** Configure in Admin → Integrations or `.env`:
```
SANCTIONS_PROVIDER=chainalysis
SANCTIONS_API_KEY=<your-key>
```

Redeploy backend.

---

## Prometheus Target Down

**Symptom:** Grafana shows no metrics; Prometheus target `down`.

**Fix:**
```bash
docker network connect exchange-production exchange-prometheus 2>/dev/null || true
docker compose -f infra/docker-compose.monitoring.yml up -d
curl -X POST http://127.0.0.1:9090/-/reload
```

Ensure `infra/prometheus/prometheus.yml` targets `exchange-backend:4000`.

---

## WebSocket / Market Data Issues

1. Check NATS: `docker compose -f docker-compose.production.yml exec nats wget -qO- http://127.0.0.1:8222/healthz`
2. Check matching engine: `docker compose -f docker-compose.production.yml logs matching-engine --tail 50`
3. Verify `PUBLIC_WS_URL=wss://PUBLIC_HOST` in `.env` matches nginx TLS

---

## Disk Full

```bash
df -h /
docker system prune -f   # Remove unused images (careful in production)
```

Rotate logs; archive old backups from `./backups/`.

---

## Collect Support Bundle

```bash
mkdir -p /tmp/exchange-support
cd /opt/exchange
bash deployment/verify.sh &> /tmp/exchange-support/verify.log
docker compose -f docker-compose.production.yml ps &> /tmp/exchange-support/ps.txt
docker compose -f docker-compose.production.yml logs backend --tail 300 &> /tmp/exchange-support/backend.log
tar czf /tmp/exchange-support-bundle.tar.gz -C /tmp exchange-support
# Do NOT include .env in support bundle
```

---

## Emergency Contacts

Document client-specific escalation paths in your runbook (not in repository).

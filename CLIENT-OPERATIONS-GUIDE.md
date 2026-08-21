# Client Operations Guide

Day-to-day operations for the Enterprise Digital Asset Exchange on a client VPS.

---

## Service Architecture

| Container | Role |
|-----------|------|
| `exchange-nginx` | TLS termination, routing |
| `exchange-frontend` | User web application |
| `exchange-admin` | Administration portal |
| `exchange-backend` | API + background workers |
| `exchange-matching-engine` | Spot order matching |
| `exchange-indexer` | Blockchain deposit detection |
| `exchange-postgres` | Primary database |
| `exchange-redis` | Cache, sessions, rate limits |
| `exchange-rabbitmq` | Async messaging |
| `exchange-nats` | Event streaming (JetStream) |
| `exchange-prometheus` | Metrics collection |
| `exchange-grafana` | Dashboards |

---

## Daily Operations

### Health check

```bash
cd /opt/exchange
bash deployment/health-check.sh
```

### Full verification

```bash
bash deployment/verify.sh
```

### View container status

```bash
docker compose -f docker-compose.production.yml ps
```

### View logs

```bash
# Backend (API + workers)
docker compose -f docker-compose.production.yml logs backend -f --tail 200

# Matching engine
docker compose -f docker-compose.production.yml logs matching-engine -f --tail 100

# Nginx
docker compose -f docker-compose.production.yml logs nginx -f --tail 50
```

---

## Emergency Procedures

### Trading halt

```bash
bash scripts/vps-trading-halt.sh halt
# After incident resolved:
bash scripts/vps-trading-halt.sh resume
```

### Restart single service

```bash
docker compose -f docker-compose.production.yml restart backend
```

### Restart full stack (no rebuild)

```bash
docker compose -f docker-compose.production.yml up -d
```

---

## Updates

```bash
cd /opt/exchange
bash deployment/update.sh
```

Pulls latest code, migrates database, rebuilds, verifies.

Pin to specific version:

```bash
bash deployment/update.sh v1.0.1
```

---

## Rollback

```bash
bash deployment/rollback.sh
# Or explicit commit/tag:
bash deployment/rollback.sh v1.0.0
```

---

## Monitoring

| Tool | URL | Default credentials |
|------|-----|-------------------|
| Grafana | `http://PUBLIC_HOST:3001` | Set in `.env` (`GRAFANA_ADMIN_*`) |
| Prometheus | `http://PUBLIC_HOST:9090` | No auth (restrict firewall) |
| Backend metrics | Internal `:4000/metrics` | Scraped by Prometheus |

### Key health endpoints (via nginx)

| Endpoint | Purpose |
|----------|---------|
| `/healthz` | Nginx alive |
| `/health/live` | Backend process alive |
| `/health` | Readiness (DB, Redis, NATS, engine) |
| `/health/deep` | Extended dependency probe |

---

## Admin Operations

Access: `https://PUBLIC_HOST/admin`

Recommended production settings (Admin → Settings / Integrations):

- SMTP for user OTP email
- SMS provider for OTP SMS
- Blockchain RPC endpoints per chain
- AML/sanctions provider for P2P
- Alert webhook URL
- Admin 2FA enrollment for all operators

---

## Worker Processes

Backend `RUN_MODE=all` runs API and workers in one container:

- Settlement worker
- Match event poller
- Deposit sweep
- Candle aggregation
- Notification consumers

Verify workers via deep health and settlement pending count (should be 0 under normal load).

---

## Maintenance Mode

Set in `.env`:

```
MAINTENANCE_MODE=true
```

Redeploy:

```bash
bash deployment/deploy.sh
```

---

## Security Operations

- Rotate JWT secrets during maintenance window (requires user re-login)
- Review `ADMIN_IP_WHITELIST` quarterly
- Audit admin activity: Admin → Audit logs
- Never commit `.env` to version control
- Restrict Grafana/Prometheus ports to operator IPs

---

## Compliance

- Configure `SANCTIONS_PROVIDER` before enabling P2P publicly
- Set `KYC_PROVIDER` credentials for identity verification
- Retain audit logs per `COMPLIANCE_AUDIT_RETENTION_DAYS`

# Deployment Requirements

## Server

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Ubuntu 22.04 LTS or 24.04 LTS | Ubuntu 24.04 LTS |
| CPU | 4 vCPU | 8+ vCPU |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 200+ GB SSD |
| Network | Public IPv4 | Static IP + domain (optional) |

## Software (installed by `deployment/install.sh`)

- Docker Engine 24+
- Docker Compose plugin v2
- Git, curl, openssl, ufw

## External Services

| Service | Required for | Notes |
|---------|--------------|-------|
| AWS KMS | Hot wallet encryption | `KMS_TYPE=aws` in production |
| SMTP | User OTP email | Configure before public launch |
| SMS provider | User OTP SMS | Twilio or equivalent |
| Blockchain RPC | Deposits/withdrawals | Alchemy/Ankr or self-hosted |
| AML provider | P2P sanctions | Required for P2P in production |
| Alert webhook | Ops alerting | Slack/PagerDuty URL |

## Secrets Checklist

All `CHANGE_ME` values in `.env.production.example` must be replaced before `deployment/deploy.sh`:

- Database, RabbitMQ passwords
- JWT, session, CSRF, encryption keys (≥32 characters)
- Engine HMAC + internal API secrets
- AWS KMS key ID and credentials (or instance role)
- `ADMIN_IP_WHITELIST` — operator IP/CIDR
- `PUBLIC_HOST` — server hostname or IP
- `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` — first super-admin (≥8 chars)
- `GRAFANA_ADMIN_PASSWORD` — Grafana login password

`DOCKER_GID` is auto-detected from the host `docker` group when unset (deployment scripts).

## Ports

| Port | Service | Exposure |
|------|---------|----------|
| 80 | HTTP (nginx) | Public |
| 443 | HTTPS (nginx) | Public |
| 3001 | Grafana | Restrict to operator IP |
| 4000 | Backend API | Internal / localhost only |
| 5432 | PostgreSQL | Localhost bind only |
| 9090 | Prometheus | Restrict to operator IP |

## Optional

- Domain name + Let's Encrypt (replace self-signed TLS via `deployment/ssl.sh`)
- Off-site backup storage for `deployment/backup.sh` output
- GitHub Container Registry images (`docker-compose.prod-images.yml`)

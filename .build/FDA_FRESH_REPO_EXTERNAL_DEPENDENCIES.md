# External Provider & Dependency Inventory

**Method:** Code and `.env.production.example` name extraction — **no secret values printed.**  
**Example env name count:** 162 unique keys in `.env.production.example`

---

## Matrix (representative — not exhaustive)

| Provider / system | Domain | Purpose | Code / config location | Required env names (sample) | Runtime on VPS |
|-------------------|--------|---------|-------------------------|----------------------------|----------------|
| **PostgreSQL** | Shared | Primary datastore | `docker-compose.production.yml`, backend | `DATABASE_URL`, `POSTGRES_*` | **Connected** |
| **Redis** | Shared | Cache, sessions | compose, backend | `REDIS_URL` | **Connected** |
| **NATS** | Crypto/spot events | JetStream | compose, matching-engine | `NATS_URL`, `USE_EVENT_STREAM` | **Connected** |
| **RabbitMQ** | Async jobs | Queues | compose, backend | `RABBITMQ_*`, `RABBITMQ_URL` | **Connected** |
| **Rust matching engine** | Crypto spot | Order matching | `matching-engine/`, compose | `MATCHING_ENGINE_URL`, `ENGINE_HMAC_SECRET`, `ENGINE_INTERNAL_SECRET` | **Connected** |
| **Indexer** | Crypto deposits | Chain scan API | `apps/indexer/` | `INDEXER_API_URL`, RPC vars | **Connected** |
| **AWS KMS** | Secrets/custody | Hot wallet envelope | backend KMS services | `AWS_KMS_KEY_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `KMS_TYPE`, `KMS_STARTUP_PROBE` | **Required at boot** (`vps-first-boot.sh`) |
| **Ethereum / BSC / BTC RPC** | Crypto | Deposits, gas | backend chain config | `ETHEREUM_RPC_URL`, `BSC_RPC_URL`, `BITCOIN_RPC_*`, `ALCHEMY_API_KEY`, `ANKR_API_KEY` | Config-dependent |
| **Block explorer APIs** | Crypto | Indexer fallback | backend | `BLOCKCYPHER_*`, `ETHERSCAN_API_KEY` | Optional |
| **Email** | Auth/notifications | OTP, alerts | backend mailer | `EMAIL_FROM`, SMTP/SendGrid-style vars in example | **Gated** by config |
| **SMS / Twilio** | 2FA | OTP delivery | backend | names in `.env.example` | **Gated** |
| **Apple / Google OAuth** | Auth | Social login | backend | `APPLE_*`, `GOOGLE_*` | **Gated** |
| **KYC / AML vendors** | Compliance | Onboarding | backend routes/services | vendor-specific in example | **Partial** |
| **Forex LP / MT5 / FIX / cTrader** | Forex | Live execution | `forex/execution/adapters` | adapter env stubs | **NOT connected** — MOCK/sim |
| **Yahoo / mock OHLC** | Forex | Candles/quotes | `forex/market-data/` | `FOREX_*` tuning vars | **Simulated** |
| **Webhooks** | Ops | Alerts | backend | `ALERT_WEBHOOK_URL` | Optional |
| **Grafana / Prometheus** | Observability | Metrics | `infra/docker-compose.monitoring.yml` | scrape configs | Containers running |
| **Docker socket** | Admin infra actions | Compose control | backend volume mount | `DOCKER_GID`, `INFRA_ACTIONS_ENABLED` | **Present** on VPS |
| **PSP / fiat rails** | Funding | INR/fiat | fiat services | fiat thresholds in example | Product-dependent |
| **Card / Mastercard** | Product | If enabled | backend card modules | card-related env if present | **Verify** in `.env.example` |

---

## Webhook / DNS / IP dependencies

| Type | Requirement |
|------|-------------|
| `PUBLIC_API_URL`, `PUBLIC_WS_URL`, `PUBLIC_ADMIN_URL` | Must match new domain/IP after migration |
| OAuth callbacks | `APPLE_CALLBACK_URL`, etc. — update in provider consoles |
| `ADMIN_IP_WHITELIST`, `INTERNAL_API_ALLOW_CIDRS` | New VPS egress/ingress |
| Webhook URLs | Re-register with PSP/alert vendors |

---

## Beta vs live-production

| Capability | Beta (current VPS) | Live production |
|------------|-------------------|-----------------|
| Forex execution | MOCK / SIMULATED | Requires LP/broker adapter + secrets |
| Crypto spot | Real engine path | RPC + KMS + indexer health |
| KYC/AML | As configured | Vendor contracts + data residency |

---

## Fresh repo reconnection checklist (names only)

1. Copy `.env.production.example` → `.env` on new host.  
2. Fill all `CHANGE_ME` and `vps-first-boot.sh` **required_vars**.  
3. Re-create or re-point **AWS KMS** key policy for new IAM role.  
4. Update **RPC provider** API keys.  
5. Reconfigure **OAuth** redirect URIs.  
6. Update **webhook endpoints** at third parties.  
7. Forex: keep MOCK until broker credentials supplied — no MT5 migration from git alone.

---

## Evidence sources

- `scripts/vps-first-boot.sh` (required env list)  
- `docker-compose.production.yml`  
- `apps/backend/src/services/forex/config.ts`  
- `.build/FDA_BETA_AUDIT_INTEGRATIONS.md` (prior read-only beta audit — cross-check only)  
- Live `/health` and `/api/v1/forex/capabilities` (2026-09-30)

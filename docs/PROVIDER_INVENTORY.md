# Provider Inventory

**Generated:** 2026-06-23  
**No secrets below — configuration references only**

## Infrastructure

| Provider | Purpose | Required env | Setup notes |
|----------|---------|--------------|-------------|
| PostgreSQL 16 | Primary DB | `DATABASE_URL`, `POSTGRES_*` | Included in compose; use managed RDS optional |
| Redis 7 | Cache, sessions, rate limits | `REDIS_URL` | Compose service; Sentinel optional |
| RabbitMQ 3 | Async jobs, OTP queue | `RABBITMQ_URL`, `RABBITMQ_USER/PASSWORD` | Compose service |
| NATS JetStream | Match events, orderbook | `NATS_URL`, `USE_EVENT_STREAM` | Compose `-js` mode |
| AWS KMS | Hot wallet envelope | `KMS_TYPE=aws`, `AWS_KMS_KEY_ID`, `AWS_REGION` | IAM role on VPS preferred |

## Email & SMS

| Provider | Purpose | Env vars | Setup |
|----------|---------|----------|-------|
| SMTP (generic) | OTP, notifications | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Gmail/SendGrid/SES |
| Twilio | SMS OTP | `SMS_PROVIDER=twilio`, `TWILIO_*` | Twilio console |

## OAuth

| Provider | Purpose | Env vars |
|----------|---------|----------|
| Google | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| Apple | Social login | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Telegram | Bot login | `TELEGRAM_BOT_TOKEN` |

## KYC

| Provider | Purpose | Env vars |
|----------|---------|----------|
| HyperVerge | Identity verification | `KYC_PROVIDER=hyperverge`, `HYPERVERGE_APP_ID`, `HYPERVERGE_APP_KEY` |

## Blockchain RPC

| Provider | Chains | Env vars |
|----------|--------|----------|
| Alchemy | ETH, Polygon, Arbitrum, Optimism, Base | `ALCHEMY_API_KEY`, `*_RPC_URL`, `*_WS_URL` |
| Ankr | BSC + fallback | `ANKR_API_KEY`, `BSC_RPC_URL` |
| Public endpoints | Solana | `SOLANA_RPC_URL` (rate limited) |
| TronGrid | TRX / TRC-20 | `TRON_API_KEY`, `TRON_API_URL` |
| BlockCypher | Bitcoin | `BLOCKCYPHER_TOKEN` |
| bitcoind | BTC self-hosted | `BITCOIN_RPC_URL`, `BITCOIN_RPC_USER/PASSWORD` |

Admin can override RPC per chain in DB (`chains.rpc_url`).

## Price oracle & external feeds

| Provider | Purpose | Env vars |
|----------|---------|----------|
| Binance public API | Oracle mid prices | `PRICE_ORACLE_ENABLED`, uses `api.binance.com` |
| External price feed | MM health / divergence | `EXTERNAL_PRICE_FEED_ENABLED`, `EXTERNAL_PRICE_FEED_BASE_URL` |
| Multi-source | Median pricing | `EXTERNAL_PRICE_FEED_SOURCES` (comma URLs) |

## Exchange / hedge integrations

| Provider | Purpose | Env / config | Notes |
|----------|---------|--------------|-------|
| **Binance** | Hedge IOC, symbol filters, credential test | DB `integration_providers` + admin UI; `binance-signed-http` | Primary external hedge |
| Coinstore | — | Not implemented in codebase | Use Binance-compatible provider row if needed |
| Liquidity bot | Internal MM quotes | `LIQUIDITY_BOT_ENABLED`, `LIQUIDITY_BOT_API_KEY` | Bot user API key |
| Hybrid engine | Route large orders | `HYBRID_ENABLED`, `HEDGE_ENABLED` | Optional |

Configure hedge providers: **Admin → Integrations** (`admin-integrations.fastify.ts`).

## Compliance

| Provider | Purpose | Env vars |
|----------|---------|----------|
| Chainalysis (example) | Sanctions screening | `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, `SANCTIONS_API_KEY` |

Production: unset sanctions provider = fail-closed blocks.

## Monitoring & alerts

| Provider | Purpose | Env vars |
|----------|---------|----------|
| Prometheus | Metrics scrape | `PROMETHEUS_ENABLED`, `infra/docker-compose.monitoring.yml` |
| Slack/webhook | Ops alerts | `ALERT_WEBHOOK_URL`, `OPS_ALERT_SLACK_URL` |
| Sentry | Error tracking | `SENTRY_DSN` |

## Push notifications

| Provider | Purpose | Env vars |
|----------|---------|----------|
| Web Push (VAPID) | Browser push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

Self-hosted — generate via `web-push` CLI in `.env.example`.

## Wallet / signing (optional)

| Component | Purpose | Env vars |
|-----------|---------|----------|
| Remote signing service | Isolated hot wallet signing | `SIGNING_REMOTE_ENABLED`, `SIGNING_SERVICE_*`, mTLS paths |

## Deposit indexer

| Component | Purpose | Env vars |
|-----------|---------|----------|
| `apps/indexer` | On-chain deposit detection | `DATABASE_URL`, RPC keys above, `INDEXER_API_URL` |

## Integration checklist for go-live

- [ ] SMTP live (OTP deliverability tested)
- [ ] SMS live (if phone auth enabled)
- [ ] At least one EVM + BTC RPC with API key
- [ ] KMS envelope + hot wallet funded
- [ ] Binance read access for oracle (public) + trade keys for hedge if enabled
- [ ] Sanctions provider or documented legal acceptance of fail-closed mode
- [ ] Alert webhook to on-call channel

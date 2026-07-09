# External Dependency Master Report

**Date:** 2026-06-23  
**Repository:** `/opt/m-live`  
**Branch:** `deployment/vps-first-boot`  
**Method:** Deep static scan — backend config, migrations (`api_settings`), indexer, matching-engine, compose, nginx, scripts, frontend/admin build args.

**Related docs:** [FINAL_LAUNCH_PREPARATION_REPORT.md](./FINAL_LAUNCH_PREPARATION_REPORT.md), [PRELAUNCH_OPERATIONS_AUDIT.md](./PRELAUNCH_OPERATIONS_AUDIT.md), [PROVIDER_INVENTORY.md](./PROVIDER_INVENTORY.md)

---

## Summary tables

### READY NOW

| Item | Provider | Credentials needed | Est. monthly cost | Priority |
|------|----------|-------------------|-------------------|----------|
| VPS host | Hetzner / OVH / DigitalOcean / bare metal | SSH key, root/sudo | $20–$200 | Critical |
| Docker + Compose | Open-source | None | $0 | Critical |
| Git repository | GitHub / self-hosted | Deploy key (optional) | $0–$20 | Medium |
| Production compose stack | Bundled images (Postgres 16, Redis 7, RabbitMQ 3, NATS, nginx) | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD` (generated) | $0 (on VPS) | Critical |
| Generated app secrets | Self | JWT, session, CSRF, encryption, engine HMAC, internal HMAC (in `.env`) | $0 | Critical |
| VPS URL config | Self | `VPS_PUBLIC_IP`, `PUBLIC_*`, `CORS_ORIGINS` | $0 | Critical |
| Deployment scripts | Repo | None | $0 | High |
| Emergency halt CLI | Redis (bundled) | None | $0 | High |
| Binance public price oracle | Binance (no key) | Outbound HTTPS only | $0 | Medium |
| Internal AML rule engine | Built-in DB rules | Threshold env vars (defaults) | $0 | Medium |
| Passkeys (WebAuthn) | Browser-native | `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` (needs real domain + HTTPS for prod) | $0 | Low (until domain) |
| Manual fiat payout | Built-in | None | $0 | Low |

---

### REQUIRED BEFORE FIRST BOOT

Before: `bash scripts/vps-first-boot.sh`

| Service | Why required | Credentials | Example provider | Config location | If missing |
|---------|--------------|-------------|------------------|-----------------|------------|
| **AWS KMS** | Production hot-wallet envelope encryption; startup probe | `AWS_KMS_KEY_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (or EC2 instance role) | AWS KMS | `.env` | Backend exits on startup |
| **AWS IAM** | KMS API permissions | IAM policy on user/role | AWS IAM | AWS console + `.env` or instance profile | KMS probe fails |
| **PostgreSQL** | Primary database | `POSTGRES_PASSWORD`, `DATABASE_URL` | Docker `postgres:16-alpine` (bundled) | `.env`, compose | Stack fails |
| **Redis** | Sessions, halt flags, rate limits | `REDIS_URL` (optional `REDIS_PASSWORD`) | Docker `redis:7-alpine` (bundled) | `.env` | Backend exits (strict mode) |
| **RabbitMQ** | OTP queue (soft-fail) | `RABBITMQ_PASSWORD`, `RABBITMQ_URL` | Docker `rabbitmq:3` (bundled) | `.env` | Startup wait; OTP falls back |
| **NATS JetStream** | Match event stream | `NATS_URL`, `USE_EVENT_STREAM=true` | Custom `infra/nats` image (bundled) | `.env`, compose | Matching engine fails |
| **Matching engine secrets** | HMAC + internal API | `ENGINE_HMAC_SECRET`, `ENGINE_INTERNAL_SECRET`, `INTERNAL_HMAC_SERVICE_SECRETS`, `INTERNAL_API_ALLOW_CIDRS` | Self-generated | `.env` | Engine/backend auth fails |
| **JWT / session / CSRF / encryption** | Auth + data at rest | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` (each ≥32 chars) | Self-generated | `.env` | Startup validation fails |
| **Admin IP whitelist** | Admin API access control | `ADMIN_IP_WHITELIST` | Your operator IP/CIDR | `.env` | All admin requests denied |
| **SLO IP whitelist** | Lock down SLO/metrics endpoints | `SLO_IP_WHITELIST` | Monitoring IPs | `.env` | SLO endpoint blocked |
| **Public URLs** | Frontend/admin Docker build + CORS | `VPS_PUBLIC_IP`, `PUBLIC_API_URL`, `PUBLIC_WS_URL`, `PUBLIC_ADMIN_URL`, `FRONTEND_URL`, `CORS_ORIGINS` | Self (IP-first OK) | `.env` | Wrong API/WS URLs in UI |
| **Tier-1 gates** | Production safety | `TIER1_LAUNCH=true`, `KYC_DIGILOCKER_DEMO_AUTO_APPROVE=false` | — | `.env` | Unsafe dev defaults |

**Not required for first boot:** SMTP, SMS, RPC keys, KYC, sanctions, hot wallets, domain, TLS (HTTP-only OK), Sentry, alert webhooks.

---

### REQUIRED BEFORE INTERNAL TESTING

Full QA of signup, login, spot, admin, engine, wallets (internal/sandbox).

| Service | Why required | Credentials | Example provider | Config location | If missing |
|---------|--------------|-------------|------------------|-----------------|------------|
| **SMTP** (email OTP) | User signup/login via email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | SendGrid, Amazon SES, Mailgun, Gmail relay | `.env` or Admin → Integrations (`api_settings` email) | OTP stored, never delivered |
| **SMS** (phone OTP) | Phone auth (if enabled) | `SMS_PROVIDER`, `TWILIO_*` or MSG91/Fast2SMS/TextLocal keys | Twilio, MSG91, Fast2SMS | `.env` or Admin → Integrations (`api_settings` sms) | Phone OTP fails |
| **Admin bootstrap TOTP** | Admin login in production | Printed by `vps-seed-admin.sh` | Self (Google Authenticator) | DB (seed output) | Cannot access admin |
| **Test user funding** | Spot order tests | Admin manual credit or internal deposit | — | Admin panel | Orders rejected (insufficient balance) |
| **At least one EVM RPC** (optional for spot-only QA) | Wallet/deposit tests | `ALCHEMY_API_KEY` or `ETH_RPC_URL` | Alchemy, Ankr | `.env` or Admin → RPC settings | Deposits not indexed |
| **AWS KMS** (same as boot) | Any wallet key operation | Same as boot | AWS | `.env` | Wallet/crypto ops fail |

**Spot + engine + market data without wallets:** Works after boot with migrated markets — Binance public oracle needs outbound HTTPS only.

**Sanctions:** Not required for spot-only internal QA (no withdrawals). Required for withdrawal/P2P/deposit screening paths.

---

### REQUIRED BEFORE PUBLIC LAUNCH

| Service | Why required | Credentials | Example provider | Config location | If missing |
|---------|--------------|-------------|------------------|-----------------|------------|
| **Domain + DNS** | Brand, OAuth, email deliverability | Registrar login, A/AAAA records | Cloudflare, Route53 | DNS provider | IP-only limits OAuth/email |
| **TLS certificates** | HTTPS trust | Cert files or Let's Encrypt | Let's Encrypt, Cloudflare | `nginx/ssl/` | HTTP-only (insecure for users) |
| **SMTP (production)** | User OTP, notifications | SMTP credentials | SendGrid / SES | `.env` or admin | Users cannot register/login |
| **SMS** (if phone auth) | Phone OTP | Provider keys | Twilio / MSG91 | `.env` or admin | Phone flow broken |
| **KYC provider** | Identity verification | HyperVerge or Onfido keys | HyperVerge, Sumsub (admin seed) | `.env` + Admin → KYC | KYC submissions fail |
| **Sanctions screening** | Withdrawals, P2P, deposits (fail-closed) | `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, `SANCTIONS_API_KEY` | Chainalysis, Elliptic, TRM, custom gateway | `.env` or `system_settings` | All screened flows **blocked** |
| **Production RPC** | Deposit indexer + withdrawals | Per-chain RPC + API keys | Alchemy + Ankr | `.env`, admin RPC, `chains` table | On-chain ops fail/rate-limited |
| **Hot wallet / custody** | Sign withdrawals | KMS + provisioned keys in DB | `scripts/provision-hot-wallets.sh` | Admin + KMS | Withdrawals fail |
| **Cold / treasury procedures** | Operational custody | Addresses documented offline | Internal ops | Admin treasury | Operational risk |
| **Alert webhook** | Circuit breaker, integrity alerts | `ALERT_WEBHOOK_URL`, optional `OPS_ALERT_SLACK_URL` | Slack incoming webhook, PagerDuty | `.env` or admin compliance alert channels | Log-only alerts |
| **Off-site DB backups** | Disaster recovery | Cron + storage credentials | S3, Backblaze, second VPS | `scripts/vps-backup-db.sh` + cron | Data loss on disk failure |
| **Tightened admin IP whitelist** | Admin security | Operator office/VPN CIDRs | — | `.env` | Admin exposed globally |
| **FIU / compliance sign-off** | Legal (India VDA) | `COMPLIANCE_FIU_OFFICER`, legal records | Internal | Admin + docs | Regulatory exposure |
| **OAuth** (if offered) | Social login | Google/Apple/Telegram credentials + callback URLs | Google Cloud, Apple Dev, Telegram BotFather | `.env` or `api_settings` social_login | Social buttons fail |
| **reCAPTCHA / Turnstile** (recommended) | Bot protection | Site key + secret | Google reCAPTCHA, Cloudflare Turnstile | Admin → Integrations | Higher bot risk |
| **Uptime monitoring** | Outage detection | Monitor URL + alert contact | UptimeRobot, Pingdom, Better Stack | External SaaS | Delayed outage discovery |

---

### OPTIONAL FUTURE IMPROVEMENTS

| Item | Provider | Credentials | Est. cost/mo | Priority |
|------|----------|-------------|--------------|----------|
| Sentry | sentry.io | `SENTRY_DSN` | $0–$80 | Medium |
| Prometheus + Grafana | Self-hosted | Grafana admin password | $0–$30 (host) | Medium |
| Datadog | datadoghq.com | API key in `api_settings` | $15–$100+ | Low |
| Binance signed API (hedge) | Binance | API key/secret in `external_liquidity_providers` | Trading fees | Low (disabled by default) |
| Liquidity bot | Internal | `LIQUIDITY_BOT_API_KEY` + funded bot user | Capital + fees | Low |
| Hybrid / hedge | Binance-compatible | DB provider rows | Variable | Low |
| Fireblocks / BitGo custody | Enterprise custody | Admin `api_settings` custody | $500+ | Low |
| Firebase FCM push | Google | Admin `api_settings` push | $0 | Low |
| Resend / SendGrid via admin | Email API | Admin `api_settings` email | $0–$20 | Low |
| CoinGecko Pro | coingecko.com | Admin `api_settings` market_data | $0–$130 | Low |
| AWS S3 / R2 / GCS | Object storage | Admin `api_settings` storage | $5–$50 | Low |
| Remote signing service | Self | `SIGNING_REMOTE_ENABLED`, mTLS certs | Infra cost | Medium (security) |
| Redis Sentinel / managed RDS | AWS ElastiCache / RDS | Connection URLs | $50–$500+ | Medium |
| GHCR CI deploy | GitHub | `VPS_SSH_KEY`, registry tokens | $0–$20 | Medium |
| Travel Rule (Notabene) | notabene.id | Admin `api_settings` travel_rule | Enterprise | Low |
| OpenAI / support SaaS | Various | Admin `api_settings` | Variable | Low |
| VAPID web push | Self-generated | `VAPID_*` in `.env` or admin | $0 | Low |
| HSM (SoftHSM) | On-prem | `HSM_*` env | Hardware | Low |

---

## Part 1 — Mandatory for first boot (detail)

See table **REQUIRED BEFORE FIRST BOOT** above. Critical path:

1. AWS account → KMS symmetric key + IAM policy  
2. Fill `.env` from `.env.production.example`  
3. Run `bash scripts/vps-first-boot.sh`

**Bundled (no external account):** PostgreSQL, Redis, RabbitMQ, NATS, nginx, matching-engine, backend, frontend, admin, indexer containers.

---

## Part 2 — Required for internal testing (detail)

| Test area | External deps | Minimum to pass |
|-----------|---------------|-------------------|
| **Signup** | SMTP and/or SMS | One delivery channel configured |
| **Login** | Same + optional TOTP app | OTP delivery or pre-seeded password user |
| **Spot trading** | Binance public (outbound HTTPS) | Test user with spot balance |
| **Admin panel** | Seed TOTP secrets | Completed first boot seed |
| **Market data** | Binance public API | None (enabled by default) |
| **Matching engine** | NATS, Redis, HMAC secrets | Satisfied at boot |
| **Wallets (full)** | KMS + RPC + hot wallets + sanctions | Full blockchain + compliance stack |

**Recommended internal testing stack:** SMTP + admin-funded test user + `vps-health-check.sh` + spot smoke order.

---

## Part 3 — Required for public launch (detail)

See **REQUIRED BEFORE PUBLIC LAUNCH** table. Launch gate order:

1. Domain + TLS  
2. SMTP (+ SMS if phone auth)  
3. KYC live  
4. Sanctions provider live  
5. Production RPC + hot wallets  
6. Alerts + backups + tightened admin IP  
7. Legal/compliance sign-off  

---

## Part 4 — Blockchain infrastructure

| Chain | Indexer support | Required RPC env | WS env (optional) | Example provider | API keys | Mandatory |
|-------|-----------------|------------------|-------------------|------------------|----------|-----------|
| **Ethereum** | EVM indexer | `ETH_RPC_URL` | `ETH_WS_URL` | Alchemy, Ankr, Infura | `ALCHEMY_API_KEY` or URL embed | **Yes** if ETH deposits/withdrawals |
| **BNB Smart Chain** | EVM indexer | `BSC_RPC_URL` | `BSC_WS_URL` | Ankr, public seed | `ANKR_API_KEY` | **Yes** if BSC enabled |
| **Polygon** | EVM indexer | `POLYGON_RPC_URL` | `POLYGON_WS_URL` | Alchemy, Ankr | `ALCHEMY_API_KEY` | Optional per enabled chain |
| **Arbitrum One** | EVM indexer | `ARBITRUM_RPC_URL` | `ARBITRUM_WS_URL` | Alchemy | `ALCHEMY_API_KEY` | Optional |
| **Optimism** | Backend defaults | `OPTIMISM_RPC_URL` | `OPTIMISM_WS_URL` | Alchemy | `ALCHEMY_API_KEY` | Optional |
| **Base** | EVM indexer | `BASE_RPC_URL` | `BASE_WS_URL` | Alchemy | `ALCHEMY_API_KEY` | Optional |
| **Solana** | `nonEvmDepositFlow` | `SOLANA_RPC_URL` | `SOLANA_WS_URL` | Helius, public (rate-limited) | Provider API key in URL | Optional |
| **Tron (TRX/TRC-20)** | `TronIndexer` | `TRON_API_URL` | — | TronGrid | `TRON_API_KEY` | Optional |
| **Bitcoin** | `BitcoinIndexer` | — | — | BlockCypher | `BLOCKCYPHER_TOKEN` | Optional |
| **Bitcoin (self-hosted)** | bitcoind | `BITCOIN_RPC_URL`, `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASSWORD` | — | Own node | RPC creds | Optional |

**Precedence:** Env override → DB `chains.rpc_url` (admin) → Ankr default (indexer) → code public defaults (backend).

**Note:** Indexer EVM chains: ethereum, bsc, polygon, base, arbitrum. Non-EVM: solana, tron, bitcoin (separate services).

**Cost guidance:** Alchemy free tier ~$0; production growth $49–$199/mo. Ankr freemium. TronGrid free tier. BlockCypher free tier limited.

---

## Part 5 — Authentication

| Method | Implementation | Required credentials | Provider | Mandatory |
|--------|----------------|---------------------|----------|-----------|
| **Email OTP** | `auth.fastify.ts` + SMTP | `SMTP_*`, `EMAIL_FROM` | Any SMTP / SendGrid / SES / Resend | **Yes** for email signup |
| **SMS OTP** | `otp.service.ts` | Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`; or MSG91/Fast2SMS/TextLocal via admin | Twilio, MSG91, Fast2SMS, TextLocal | **Yes** if phone auth enabled |
| **Password login** | Auth routes | None external | Built-in | Optional (OTP-first UX) |
| **Google OAuth** | Passport-style env | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google Cloud Console | Optional |
| **Apple Sign In** | Env + JWT key | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Apple Developer | Optional |
| **Telegram login** | Bot API | `TELEGRAM_BOT_TOKEN` | @BotFather | Optional |
| **TOTP (user 2FA)** | `totp-verify` | None external | Google Authenticator / Authy | Optional (policy may require for withdrawals) |
| **Admin TOTP** | Mandatory in production | Bootstrap secret from seed | Authenticator app | **Yes** for admin |
| **Passkeys (WebAuthn)** | `@simplewebauthn/server` | `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_NAME` | Browser-native | Optional (needs HTTPS + domain) |
| **Admin break-glass** | Emergency login | `ADMIN_BREAK_GLASS_ENABLED`, `ADMIN_BREAK_GLASS_SECRET`, `ADMIN_BREAK_GLASS_ALLOWED_IPS` | Self | Optional emergency |
| **JWT sessions** | Internal | `JWT_*`, `SESSION_SECRET` | Self | **Yes** |

---

## Part 6 — Trading & market data

| Integration | Purpose | Credentials | Mandatory |
|-------------|---------|-------------|-----------|
| **Binance public REST** | Price oracle, reference prices, MM health divergence | None (public `api.binance.com`) | **Yes** (default oracle) — outbound HTTPS |
| **Binance public WS** | Optional candle/chart data | None | Optional |
| **Binance signed API** | Hedge IOC, external liquidity | API key + secret in `external_liquidity_providers` (admin) | Optional (`HEDGE_ENABLED=false`) |
| **External liquidity providers** | Hybrid routing | DB: `provider_name`, `base_url`, encrypted secrets | Optional |
| **Internal matching engine** | Spot matching | `ENGINE_HMAC_SECRET`, NATS, Redis | **Yes** |
| **NATS JetStream** | Match → settlement pipeline | `NATS_URL` | **Yes** |
| **Liquidity bot** | Internal MM quotes | `LIQUIDITY_BOT_ENABLED`, `LIQUIDITY_BOT_API_KEY` | Optional (disabled) |
| **CoinGecko public** | Coin logos / reference prices in UI | None (public API) | Optional |
| **CoinGecko Pro** | Higher rate limits | Admin `api_settings` market_data | Optional |
| **Synthetic candles** | Dev only | `ALLOW_SYNTHETIC_CANDLES` | **No** in production |

---

## Part 7 — Notifications

| Channel | Credentials | Recommended provider | Config | Mandatory |
|---------|-------------|---------------------|--------|-----------|
| **SMTP** | Host, port, user, password, from | Amazon SES or SendGrid | `.env` or admin email/smtp | **Yes** (launch) |
| **SendGrid** | API key as SMTP password | SendGrid | Admin `api_settings` email/sendgrid | Optional |
| **Mailgun** | SMTP credentials | Mailgun | Admin or `.env` | Optional |
| **Amazon SES** | SMTP or IAM | AWS SES | `.env` | Optional |
| **Resend** | API key | Resend | Admin `api_settings` email/resend | Optional |
| **Twilio SMS** | SID, token, phone number | Twilio | `.env` or admin sms/twilio | If phone OTP |
| **MSG91 / Fast2SMS / TextLocal** | API keys | India-focused SMS | Admin `api_settings` sms | Optional |
| **Slack webhook** | Incoming webhook URL | Slack | `ALERT_WEBHOOK_URL`, `OPS_ALERT_SLACK_URL`, admin alert channels | **Recommended** |
| **PagerDuty** | Integration key | PagerDuty | Admin `alert_pagerduty_key` | Optional |
| **Generic alert webhook** | URL | Any JSON POST receiver | `ALERT_WEBHOOK_URL` | **Recommended** |
| **Ops email webhook** | URL | SendGrid-compatible relay | `OPS_ALERT_EMAIL_WEBHOOK_URL` | Optional |
| **Telegram bot** | Bot token | Telegram | OAuth/login only (not ops alerts by default) | Optional |
| **Discord** | — | Not first-class in code | Use generic webhook | Optional |
| **Web Push (VAPID)** | Public/private key pair | Self-generated (`web-push`) | `.env` or admin web_push/vapid | Optional |
| **Firebase FCM** | Firebase project keys | Google | Admin `api_settings` push/firebase | Optional |
| **In-app notifications** | None | Built-in DB | — | Bundled |
| **RabbitMQ OTP queue** | `RABBITMQ_URL` | Bundled | `.env` | Optional (`OTP_USE_RABBITMQ_QUEUE=false` default) |

---

## Part 8 — Compliance

| Type | Providers in codebase | Credentials | Mandatory (public launch) |
|------|----------------------|-------------|---------------------------|
| **KYC** | HyperVerge (primary), Onfido (config enum), Sumsub (admin seed), DigiLocker (IN demo — blocked in prod) | `HYPERVERGE_APP_ID`, `HYPERVERGE_APP_KEY` or admin KYC rows | **Yes** |
| **AML monitoring** | Built-in rules + DB logs | Threshold env: `AML_*`, `GEO_BLOCKED_COUNTRIES` | **Yes** (internal rules) |
| **Sanctions** | Chainalysis, Elliptic, TRM (admin seeds); generic HTTP gateway | `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, `SANCTIONS_API_KEY` | **Yes** (fail-closed in prod) |
| **Travel Rule** | Notabene (admin seed) | Admin `api_settings` travel_rule | Optional (jurisdiction-dependent) |
| **FIU India** | Internal STR/CTR queues + admin APIs | `COMPLIANCE_FIU_OFFICER`, legal sign-off | **Yes** (India VDA entities) |
| **VPN/TOR detection** | Built-in service | None external | Optional signal |
| **IP/geo rules** | Built-in + admin | `GEO_BLOCKED_COUNTRIES` | Recommended |

---

## Part 9 — Monitoring & operations

| System | Credentials | Config | Mandatory |
|--------|-------------|--------|-----------|
| **Health endpoints** | None | nginx → `/health`, `/health/live` | **Yes** (bundled) |
| **Prometheus metrics** | None | Scrape `127.0.0.1:4000/metrics`; `PROMETHEUS_ENABLED=true` | Recommended |
| **Prometheus server** | None | `infra/docker-compose.monitoring.yml` | Optional |
| **Grafana** | `GF_SECURITY_ADMIN_PASSWORD` (default in compose — change) | Same monitoring compose | Optional |
| **Sentry** | `SENTRY_DSN` | `.env` or admin monitoring/sentry | Optional |
| **Alert webhooks** | Webhook URLs | `ALERT_WEBHOOK_URL`, admin alert channels | **Recommended** (Critical for ops) |
| **DB backups** | Storage creds for off-site copy | `scripts/vps-backup-db.sh` + cron | **Yes** (launch) |
| **Uptime monitoring** | SaaS account | External ping to `/health/live` | Recommended |
| **Log aggregation** | — | `docker compose logs` only today | Optional (CloudWatch/Loki) |
| **Tier-1 reconciliation jobs** | None | Built-in workers | Bundled |
| **Incident drill script** | None | `scripts/incident-drill.sh` | Recommended practice |

---

## Part 10 — Operator checklists

### 1. Exact accounts to create

| # | Account | When |
|---|---------|------|
| 1 | **AWS** (KMS + IAM user or EC2 role) | Before first boot |
| 2 | **Domain registrar** + **DNS** (Cloudflare/Route53) | Before public launch |
| 3 | **SMTP provider** (SendGrid / SES / Mailgun) | Before internal testing |
| 4 | **SMS provider** (Twilio or MSG91) — if phone auth | Before internal testing |
| 5 | **Alchemy** (EVM RPC) | Before wallet testing |
| 6 | **Ankr** (BSC + fallback RPC) | Before wallet testing |
| 7 | **TronGrid** — if TRX/TRC-20 | Before Tron launch |
| 8 | **BlockCypher** — if BTC | Before BTC launch |
| 9 | **HyperVerge** (or chosen KYC vendor) | Before public launch |
| 10 | **Sanctions vendor** (Chainalysis / Elliptic / TRM / gateway) | Before public launch |
| 11 | **Slack workspace** (or PagerDuty) for alerts | Before public launch |
| 12 | **Off-site backup storage** (S3, Backblaze B2, etc.) | Before public launch |
| 13 | **Uptime monitor** (UptimeRobot, Better Stack) | Before public launch |
| 14 | **Google Cloud** — if Google OAuth | Optional |
| 15 | **Apple Developer** — if Sign in with Apple | Optional |
| 16 | **Telegram BotFather** — if Telegram login | Optional |
| 17 | **Binance** — only if enabling hedge (`HEDGE_ENABLED=true`) | Optional |
| 18 | **Sentry** — error tracking | Optional |
| 19 | **GitHub** — if using GHCR CI deploy | Optional |

---

### 2. Exact API keys to obtain

| Key | From | Used for |
|-----|------|----------|
| AWS KMS Key ARN | AWS KMS console | Wallet encryption |
| AWS Access Key + Secret (or instance role) | AWS IAM | KMS API calls |
| SMTP / SendGrid / SES credentials | Email provider | OTP email |
| Twilio SID + Auth Token + phone number | Twilio | SMS OTP |
| Alchemy API key | dashboard.alchemy.com | ETH, Polygon, Arbitrum, Optimism, Base RPC |
| Ankr API key | ankr.com/rpc | BSC + RPC fallback |
| TronGrid API key | trongrid.io | Tron indexing |
| BlockCypher token | blockcypher.com | Bitcoin indexing |
| HyperVerge App ID + App Key | HyperVerge dashboard | KYC |
| Sanctions API key + endpoint URL | Compliance vendor | Withdrawals/P2P/deposits |
| Slack incoming webhook URL | Slack | Ops alerts |
| Google OAuth Client ID + Secret | Google Cloud Console | Social login |
| Apple Sign In keys | Apple Developer | Social login |
| Telegram Bot Token | BotFather | Telegram login |
| Binance API key + secret | Binance | Hedge only (optional) |
| Sentry DSN | sentry.io | Error tracking (optional) |
| Let's Encrypt / Cloudflare | TLS automation | HTTPS (launch) |

---

### 3. Exact secrets to configure (generate yourself)

Generate with `openssl rand -hex 32` or similar (≥32 chars each):

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `CSRF_SECRET`
- `ENCRYPTION_KEY`
- `ENGINE_HMAC_SECRET` (= value in `INTERNAL_HMAC_SERVICE_SECRETS` for matching-engine)
- `ENGINE_INTERNAL_SECRET`
- `POSTGRES_PASSWORD`
- `RABBITMQ_PASSWORD`
- Admin seed passwords (rotate after first login)
- Bootstrap admin TOTP secret (from seed output — store in password manager)
- Optional: `ADMIN_BREAK_GLASS_SECRET`
- Optional: VAPID key pair (`web-push` generate)
- Optional: `SIGNING_SERVICE_HMAC_SECRET` (remote signing)

---

### 4. Exact credentials to add into `.env` (production)

**Must be in `.env` before first boot:**

```env
# VPS
VPS_PUBLIC_IP=
PUBLIC_API_URL=
PUBLIC_WS_URL=
PUBLIC_ADMIN_URL=
FRONTEND_URL=
CORS_ORIGINS=

# Database / messaging (bundled services)
POSTGRES_PASSWORD=
DATABASE_URL=
RABBITMQ_PASSWORD=
RABBITMQ_URL=
REDIS_URL=

# Auth secrets
JWT_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=
CSRF_SECRET=
ENCRYPTION_KEY=

# AWS KMS (mandatory production)
KMS_TYPE=aws
AWS_KMS_KEY_ID=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Engine / internal
ENGINE_HMAC_SECRET=
ENGINE_INTERNAL_SECRET=
INTERNAL_HMAC_SERVICE_SECRETS=matching-engine=<same-as-ENGINE_HMAC_SECRET>
INTERNAL_API_ALLOW_CIDRS=

# Admin security
ADMIN_IP_WHITELIST=
SLO_IP_WHITELIST=

# Tier-1
TIER1_LAUNCH=true
KYC_DIGILOCKER_DEMO_AUTO_APPROVE=false
```

**Add to `.env` before internal testing:**

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

# If phone auth:
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Add to `.env` before public launch:**

```env
SANCTIONS_PROVIDER=
SANCTIONS_API_URL=
SANCTIONS_API_KEY=

HYPERVERGE_APP_ID=
HYPERVERGE_APP_KEY=

ALCHEMY_API_KEY=
ANKR_API_KEY=
ETH_RPC_URL=
POLYGON_RPC_URL=
BSC_RPC_URL=
# ... other chains as enabled

ALERT_WEBHOOK_URL=
OPS_ALERT_SLACK_URL=

# After domain + TLS:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
WEBAUTHN_RP_ID=
WEBAUTHN_ORIGIN=

SENTRY_DSN=          # optional
VAPID_PUBLIC_KEY=    # optional
VAPID_PRIVATE_KEY=
```

---

### 5. Credentials configured later from admin panel

Stored in **`api_settings`** (Integrations / Settings) or related admin tables — override `.env` when active:

| Category | Providers (from migrations) |
|----------|----------------------------|
| **email** | smtp, sendgrid, resend |
| **sms** | fast2sms, twilio, msg91, textlocal |
| **kyc** | hyperverge, sumsub |
| **rpc** | ethereum, bsc, polygon (+ per-chain URLs) |
| **aml** | chainalysis, trm, elliptic |
| **travel_rule** | notabene |
| **social_login** | google, apple, telegram |
| **web_push** | vapid |
| **push** | firebase |
| **recaptcha** | google |
| **captcha** | turnstile, hcaptcha |
| **market_data** | coingecko |
| **chart** | binance |
| **monitoring** | sentry, datadog |
| **storage** | s3, r2, gcs |
| **custody** | fireblocks, bitgo |
| **analytics** | ga4, posthog, mixpanel |
| **support** | zendesk, freshdesk, intercom |
| **ai** | openai, anthropic, gemini |

**Also admin-configured (not only `.env`):**

- `external_liquidity_providers` — Binance hedge keys, base URLs  
- `system_settings` — sanctions override, alert webhooks, oracle tuning  
- `chains` table — RPC URL overrides  
- `feature_toggles` — deposit/withdrawal enable  
- Hot wallet addresses / treasury (admin wallet ops)  
- Compliance alert channels (`alert_webhook_url`, `alert_slack_webhook_url`, `alert_pagerduty_key`)

---

### 6. Launch readiness score (after services connected)

| Stage | Score | What is connected |
|-------|-------|-------------------|
| **Current (pre-boot)** | **58 / 100** | VPS, Docker, generated secrets, compose; **KMS pending** |
| **After first boot** | **68 / 100** | + KMS, stack up, admin seed, health checks |
| **After internal testing deps** | **78 / 100** | + SMTP/SMS, test users, spot smoke verified |
| **After public-launch deps** | **92 / 100** | + domain/TLS, KYC, sanctions, RPC, hot wallets, alerts, backups, tightened admin IP |
| **Full enterprise** | **98 / 100** | + Sentry, Grafana, remote signing, managed DB, custody partner |

**Remaining 8 points:** DR drills proven, 24/7 on-call, legal sign-off, penetration test, multi-region — operational maturity beyond configuration.

---

## Infrastructure dependency map

```
                    ┌─────────────┐
                    │   AWS KMS   │ ← mandatory boot
                    └──────┬──────┘
                           │
┌──────────┐    ┌──────────▼──────────┐    ┌─────────────┐
│  nginx   │───│      backend        │───│  PostgreSQL │ (bundled)
└──────────┘    │  + workers + API    │    └─────────────┘
                └─────────┬───────────┘
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌───────────┐     ┌──────────┐
   │  Redis  │      │ matching  │     │ RabbitMQ │
   │(bundled)│      │  engine   │     │(bundled) │
   └─────────┘      └─────┬─────┘     └──────────┘
                          │
                     ┌────▼────┐
                     │  NATS   │ (bundled)
                     └─────────┘

External (testing):  SMTP / SMS
External (wallets):  Alchemy / Ankr / TronGrid / BlockCypher
External (launch):   KYC + Sanctions + Alerts + DNS/TLS + Backups
External (optional): Binance signed, Sentry, Grafana, OAuth
```

---

## Cost summary (estimated monthly, USD)

| Tier | Services | Est. total |
|------|----------|------------|
| **First boot only** | VPS + AWS KMS usage | $25–$220 |
| **Internal testing** | + SMTP + SMS + Alchemy free | $30–$280 |
| **Public launch** | + KYC + sanctions + RPC paid + alerts + backups + domain | $150–$800+ |
| **With hedge/MM** | + Binance fees + capital | Variable |

*Sanctions and KYC enterprise pricing is often custom — budget separately.*

---

*Generated from repository scan. No secrets from live `.env` are included. Re-run this audit when enabling new chains, hedge, or custody integrations.*

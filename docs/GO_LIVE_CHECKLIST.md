# Go-Live Checklist

**Generated:** 2026-06-23  
Use with prior audits (infrastructure, security, UX) — do not re-run full audits here.

## Database

- [ ] Migrations applied (`npm run db:migrate`)
- [ ] `tier1:release-check:strict` passed on staging (optional)
- [ ] Connection pooling sized for VPS (`DATABASE_POOL_MAX`)
- [ ] Automated backups scheduled (`scripts/backup-db.sh`)
- [ ] Restore drill completed once

## Wallets & KMS

- [ ] `KMS_TYPE=aws` (or approved HSM) configured
- [ ] `KMS_STARTUP_PROBE=1` passes on boot
- [ ] Hot wallets provisioned per asset/chain
- [ ] Cold wallet addresses documented offline
- [ ] Withdrawal whitelist policy enabled (`WITHDRAWAL_WHITELIST_RELAXED=false`)
- [ ] Treasury reconcile worker running

## Binance & external liquidity

- [ ] Price oracle fetching (`PRICE_ORACLE_ENABLED=true`)
- [ ] External feed divergence thresholds set
- [ ] Hedge provider credentials in admin Integrations (if `HEDGE_ENABLED`)
- [ ] Liquidity bot API key + user funded (if `LIQUIDITY_BOT_ENABLED`)
- [ ] MM control dashboard accessible (`/admin/mm-control`)

## Coinstore / other exchanges

- [ ] Not in codebase — configure Binance-compatible provider if needed

## Monitoring & alerts

- [ ] `ALERT_WEBHOOK_URL` or `OPS_ALERT_SLACK_URL` tested
- [ ] Prometheus scraping `/metrics` (optional stack)
- [ ] `/health` and `/health/deep` monitored externally
- [ ] Engine WAL disk usage alert
- [ ] Postgres disk alert

## Treasury & emergency controls

- [ ] Admin can access Treasury (`/treasury`)
- [ ] Trading halt tested: pause → resume
- [ ] Withdraw freeze tested: disable → enable
- [ ] MM circuit pause tested
- [ ] Liquidity kill switch tested (`/control/liquidity-kill`)
- [ ] Break-glass procedure documented (if enabled)

## Security

- [ ] `ADMIN_IP_WHITELIST` set to operator IPs
- [ ] Default admin password changed
- [ ] JWT secrets rotated from templates
- [ ] `ENGINE_HMAC_SECRET` unique per environment
- [ ] TLS certificates valid and auto-renew configured
- [ ] `SANCTIONS_PROVIDER` configured or legal sign-off for fail-closed

## User-facing flows (smoke — not full audit)

- [ ] Login / OTP email delivery
- [ ] KYC submission path
- [ ] Deposit address generation (post-KYC)
- [ ] Spot limit order place + cancel
- [ ] Wallet withdraw screen loads
- [ ] P2P listing visible (if enabled)

## Backups & recovery

- [ ] DB backup off-site
- [ ] `engine_wal` volume snapshotted
- [ ] `.env` stored in secure vault (1Password / AWS SM)
- [ ] `provider-secrets.json` offline encrypted copy

## Legal & compliance

- [ ] `COMPLIANCE_LEGAL_SIGNOFF_ID` recorded
- [ ] FIU officer assigned (`COMPLIANCE_FIU_OFFICER`)
- [ ] Privacy/terms pages live
- [ ] AML thresholds reviewed (`AML_*` env)

## Launch decision

| Gate | Owner |
|------|-------|
| Technical go-live | Engineering |
| Treasury funded | Finance |
| Legal/compliance | Compliance officer |
| Public announcement | Product |

Reference: `audit/GO_LIVE_VALIDATION.md` (runtime smoke), `audit/MASTER-LAUNCH-AUDIT.md` (prior summary).

# Production Deployment Checklist

Use before **first production launch** and before **each major release** on a client VPS.

---

## A. Infrastructure

- [ ] Ubuntu 22.04/24.04 LTS provisioned (4+ vCPU, 16+ GB RAM, 100+ GB SSD)
- [ ] `deployment/install.sh` completed successfully
- [ ] `deployment/firewall.sh` applied (ports 22, 80, 443 only public)
- [ ] PostgreSQL bound to localhost only (compose default)
- [ ] NTP/time sync enabled (`timedatectl status`)
- [ ] Off-site backup destination configured

---

## B. Configuration

- [ ] `.env` created from `.env.production.example`
- [ ] All `CHANGE_ME` placeholders replaced
- [ ] `PUBLIC_HOST` set to production IP or domain
- [ ] `PUBLIC_*` URLs consistent with TLS mode
- [ ] `ADMIN_IP_WHITELIST` set to operator IPs
- [ ] JWT, session, CSRF, encryption keys ≥32 chars (unique per deployment)
- [ ] `ENGINE_HMAC_SECRET` matches `INTERNAL_HMAC_SERVICE_SECRETS`
- [ ] AWS KMS configured and startup probe passes
- [ ] `.env` stored in secrets vault (not in git)

---

## C. Security

- [ ] Default admin passwords changed after first login
- [ ] `ADMIN_2FA_MANDATORY=true` (recommended before public launch)
- [ ] `SANCTIONS_PROVIDER` configured if P2P enabled
- [ ] `ALERT_WEBHOOK_URL` configured
- [ ] TLS certificates valid (self-signed OK for IP; LE for domain)
- [ ] Grafana/Prometheus restricted to operator network

---

## D. Deployment

- [ ] `bash deployment/deploy.sh` completed without errors
- [ ] `bash deployment/verify.sh` — all PASS
- [ ] All 12 containers healthy (`docker compose ps`)
- [ ] Deep health: database, redis, nats, matching_engine, indexer = up
- [ ] Settlement pending = 0
- [ ] Spot markets API returns 200

---

## E. Integrations

- [ ] SMTP configured (user OTP email)
- [ ] SMS provider configured (user OTP SMS)
- [ ] Blockchain RPC configured for enabled chains
- [ ] Hot wallets provisioned (post-KMS)
- [ ] Price oracle enabled (`PRICE_ORACLE_ENABLED=true`)
- [ ] KYC provider configured (if KYC required)

---

## F. Operations

- [ ] Daily backup cron scheduled (`deployment/backup.sh`)
- [ ] Monthly restore drill scheduled
- [ ] Monitoring dashboards accessible (Grafana)
- [ ] On-call alert routing tested
- [ ] Trading halt/resume procedure documented for team
- [ ] Rollback procedure tested on staging

---

## G. Legal / Compliance (Client Responsibility)

- [ ] FIU/regulatory registration (if applicable)
- [ ] Privacy policy and terms published
- [ ] AML/KYC policies approved
- [ ] Data retention policy aligned with `COMPLIANCE_AUDIT_RETENTION_DAYS`

---

## Sign-Off

| Checklist section | Status | Owner | Date |
|-------------------|--------|-------|------|
| A. Infrastructure | | | |
| B. Configuration | | | |
| C. Security | | | |
| D. Deployment | | | |
| E. Integrations | | | |
| F. Operations | | | |
| G. Compliance | | | |

**Production launch authorized:** ☐ Yes ☐ No

**Authorized by:** ___________________ **Date:** ___________

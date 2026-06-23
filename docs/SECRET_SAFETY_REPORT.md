# Secret Safety Report

**Generated:** 2026-06-23  
**Method:** Pattern scan + `.gitignore` review + template audit

## Verdict: PASS (repository tree)

No committed AWS keys (`AKIA*`), PEM private keys, or hardcoded production API secrets were found in tracked source.

## Scans performed

| Check | Result |
|-------|--------|
| `AKIA[0-9A-Z]{16}` (AWS access keys) | None |
| `BEGIN RSA PRIVATE KEY` / `BEGIN PRIVATE KEY` | None in source |
| `.env` / `.env.local` committed | Gitignored — not in index |
| `backups/*.sql.gz` | Gitignored; removed if present |
| `provider-secrets.json` | Gitignored; template only |

## `.gitignore` hardening (applied)

```
*.pem, *.key, secrets/, keys/
.env, .env.*, *.env
provider-secrets.json
backups/
audit/**/screenshots/
audit-artifacts/
*.sql.gz
```

## Placeholder values (safe)

| Location | Content |
|----------|---------|
| `.env.example` | `your-super-secret-jwt-key-min-32-chars` |
| `.env.production.example` | `CHANGE_ME_*` placeholders |
| `backups/provider-secrets.template.json` | Empty strings only |
| CI workflows | Ephemeral `dev-jwt-secret-*` for test containers only |

## CI workflow secrets (GitHub — not in repo)

Required for `production.yml` deploy:

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Deploy target IP/hostname |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Private key for deploy |
| `VPS_DEPLOY_PATH` | Optional; default `/opt/exchange` |
| `PUBLIC_HEALTH_URL` | Optional post-deploy check |

`GITHUB_TOKEN` used for GHCR push (automatic).

## Production secrets (VPS `.env` only)

Must never be committed:

- `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`
- `JWT_*`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`
- `ENGINE_HMAC_SECRET`, `ENGINE_INTERNAL_SECRET`, `INTERNAL_HMAC_SERVICE_SECRETS`
- `AWS_KMS_KEY_ID` + IAM role or keys
- `MASTER_SEED_ENCRYPTED`, hot wallet material
- `SMTP_*`, `TWILIO_*`, OAuth client secrets
- `ALCHEMY_API_KEY`, `ANKR_API_KEY`, RPC URLs with embedded keys
- `BINANCE` / hedge provider API keys (DB or env)
- `SANCTIONS_API_KEY`, `HYPERVERGE_*`

Use `backups/provider-secrets.template.json` → copy to `provider-secrets.json` locally for encrypted offline backup.

## Code patterns (good)

- Hot wallet keys loaded from KMS/envelope, not source  
- Admin break-glass secret from env  
- Engine HMAC verified per-service via `INTERNAL_HMAC_SERVICE_SECRETS`  
- `validateProductionConfig()` fails startup on missing Tier-0 secrets  

## Residual risks (operational)

| Risk | Mitigation |
|------|------------|
| Dev defaults in `docker-compose.yml` | Use `docker-compose.production.yml` only on VPS |
| `seed-admin.ts` default password in docs | Change immediately after first login |
| E2E credentials file | Gitignored `e2e/.e2e-credentials.json` |
| WAL on host `~/.exchange/` | Gitignored `.exchange/` |

## Secret Safety Score: **92 / 100**

−8: relies on operator not committing `.env`; recommend pre-push hook or `gitleaks` in CI (optional).

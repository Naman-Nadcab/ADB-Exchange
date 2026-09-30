# Proposed Fresh Repository Tree

**Principle:** Same monorepo layout as today — **no aesthetic restructure.** Only exclude non-shippable paths and add minimal new files for identity/CI.

---

## Direct map (keep path as-is)

```text
/
├── apps/
│   ├── frontend/          # Customer (Crypto + Forex UI)
│   ├── admin-panel/       # Ops/admin
│   ├── backend/           # API + migrate.ts + workers
│   ├── indexer/
│   └── mobile/            # Optional product slice
├── packages/              # Shared libraries
├── matching-engine/       # Rust
├── nginx/
├── infra/
│   ├── nats/
│   ├── grafana/
│   ├── prometheus/
│   └── docker-compose.monitoring.yml
├── scripts/               # vps-first-boot, migrate, backup
├── e2e/
├── load/
├── security/
├── deployment/
├── docs/                  # SHOULD — ops runbooks
├── brand/
├── session-core/
├── edge-auth-gateway/
├── docker-compose.yml
├── docker-compose.production.yml
├── docker-compose.prod-images.yml
├── docker-compose.forex-demo.yml
├── package.json
├── package-lock.json
├── turbo.json
├── playwright*.config.ts
├── .github/workflows/
├── .dockerignore
├── .gitignore
├── .env.example
├── .env.production.example
└── README.md              # Rewrite intro for FDA Exchange (new content)
```

---

## Intentionally excluded (not in fresh tree)

```text
.git/                      # New history
node_modules/
**/.next/ **/dist/ **/target/
.env .env.* (except *.example)
release-freeze-*.bundle
release-backup/ release/
backups/ *.sql.gz
logs/ test-results/ playwright-report/
.deploy-rev* .deploy-backup*
audit/                     # Optional — exclude by default
.build/                    # Optional — exclude except migration audit pack if desired
Root legacy *_AUDIT.md     # ~80 files — exclude unless archival repo
uat-evidence/ .audit-screenshots/
apps/backend/data/p2p-payment-proofs/
```

---

## Files to create fresh (post-copy)

| File | Purpose |
|------|---------|
| `.git/` | `git init` |
| `LICENSE` | If not present — legal |
| `README.md` | FDA Exchange identity, boot pointer to `vps-first-boot.sh` |
| `.github/workflows/*.yml` | Updated `repository_owner`, branches, secrets |
| `CHANGELOG.md` | Optional — initial import note |
| `.deploy-rev` | Optional — new SHA tracking (gitignored today) |

---

## Files to regenerate (never copy)

- `package-lock.json` — **copy from snapshot** (do not regenerate unless resolving conflicts)  
- Docker images — build on CI/VPS  
- `nginx/ssl/*.pem` — generate or install  
- `.env` — from example + secret store  

---

## Domain integrity (unchanged layout)

```text
FDA Exchange (repo root)
├── Crypto     → apps/frontend (spot), matching-engine, crypto ledger in backend
├── Forex      → apps/frontend/forex/*, backend/services/forex/*
├── Customer   → apps/frontend
└── Admin      → apps/admin-panel + backend admin routes
```

No directory moves required — separation is **service/module** level, not folder rename.

---

## Diff vs current VPS disk usage

| VPS only | Fresh repo |
|----------|------------|
| ~1902 untracked `.build/` files | Omit by default |
| 219 MB `release-freeze-backup-*.bundle` | Omit |
| `node_modules/` (1171 packages) | Regenerate |
| Dirty 228 app files | **Must be committed into fresh initial commit** |

**Target tracked file count (estimate):** ~3605 + net new untracked app files − excluded docs ≈ **3700–4000** files in initial commit if all REQUIRED dirty paths added and historical root markdown stripped.

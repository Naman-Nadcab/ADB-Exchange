# Old Repository / Project Lineage Audit

**Scope:** References that expose prior org/repo/product names. **Nothing modified.**

---

## Git remotes

| Remote | URL | Classification |
|--------|-----|----------------|
| `origin` | `git@github.com:Naman-Nadcab/m-live.git` | **MUST CHANGE** for fresh FDA repo remote |
| `product` | `git@github.com:Naman-Nadcab/metherium_final_v.1.git` | **MUST CHANGE** or remove — prior migration target (2026-08 report: push failed RO deploy key) |

---

## Docker / compose identity

| Reference | Where | Classification |
|-----------|--------|----------------|
| `m-live-frontend`, `m-live-backend`, `m-live-admin-panel`, `m-live-indexer`, `m-live-matching-engine` | Local image tags on VPS | **MUST CHANGE** (rename to `fda-exchange-*` or GHCR path) |
| `m-live_postgres_data`, `m-live_redis_data`, … | Docker volumes | **REQUIRES DECISION** — rename implies new empty volumes or migration |
| `COMPOSE_PROJECT_DIR: /opt/m-live` | compose + backend | **MUST CHANGE** path or keep `/opt/m-live` as mount convention |
| Project directory `/opt/m-live` | Filesystem | **REQUIRES DECISION** — ops habit vs new path `/opt/fda-exchange` |

---

## CI / registry

| Reference | File | Classification |
|-----------|------|----------------|
| `ghcr.io/${{ github.repository_owner }}/exchange` | `.github/workflows/production.yml` | **MUST CHANGE** to new org/repo/image prefix |
| `IMAGE_PREFIX: ghcr.io/.../exchange` | same | **MUST CHANGE** |

---

## Package / product names

| Name | Location | Classification |
|------|----------|----------------|
| `crypto-exchange` | root `package.json` `"name"` | **REQUIRES DECISION** — rename to `fda-exchange` for branding vs minimal diff |
| `@exchange/*` workspaces | `apps/*/package.json` | **SAFE TO RETAIN** internally (scoped npm names) |
| `Enterprise-grade Spot Trading + P2P…` | package description | **REQUIRES DECISION** — marketing copy |
| `Metherium Exchange` | `NEW-REPOSITORY-MIGRATION-REPORT.md` | **Historical doc** — exclude or rewrite in fresh repo |
| `FDA Exchange` | User/product term | **SAFE TO RETAIN** — target product name |

---

## Documentation / audit lineage

| Pattern | Count | Classification |
|---------|-------|----------------|
| Root `*_AUDIT.md`, `FOREX_*`, `EXCHANGE_*` | 80+ files | **OPTIONAL** — exclude from fresh repo to reduce noise |
| `.build/*` deployment proofs referencing `m-live@sha256:…` | many | **OPTIONAL** — historical |
| `Naman-Nadcab` in `.build` JSON | admin maps | **OPTIONAL** if not copying `.build` |

---

## Domains / URLs

| Item | Evidence | Classification |
|------|----------|----------------|
| `109.123.254.30` | Live VPS | **EXTERNAL** — not in git as sole domain |
| `api.example.com` | CI workflow build env | **Placeholder** — **SAFE TO RETAIN** in CI template |
| `PUBLIC_*` in `.env` on host | runtime | **RECONFIGURE** on migration |

---

## Branch names

| Branch | Classification |
|--------|----------------|
| `release/exchange-production-baseline` | **REQUIRES DECISION** — keep name vs `main` for fresh repo |
| `main` in CI | **MUST ALIGN** workflow triggers with chosen default branch |

---

## Service container names

| Name | Classification |
|------|----------------|
| `exchange-frontend`, `exchange-backend`, … | **SAFE TO RETAIN** — generic, no old repo name |

---

## Summary table

| Action | Items |
|--------|--------|
| **MUST CHANGE** | Git remote URLs, local/GHCR image prefix, CI registry vars |
| **SAFE TO RETAIN** | `exchange-*` container names, `@exchange/*` package scope, architecture layout |
| **REQUIRES DECISION** | Filesystem path, compose project name/volumes, root package.json name, branch naming, whether to copy historical markdown |
| **UNKNOWN** | Mobile app store bundle IDs — not scanned in this audit |

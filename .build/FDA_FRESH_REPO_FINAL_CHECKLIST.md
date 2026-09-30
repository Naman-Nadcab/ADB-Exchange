# Fresh Git Repository Migration — Operational Checklist

**Use with:** `FDA_FRESH_REPO_MIGRATION_AUDIT.md`, `FDA_FRESH_REPO_COPY_MANIFEST.md`

---

## BEFORE COPY

- [ ] Record baseline: branch `release/exchange-production-baseline`, HEAD `effd130`, dirty count 821 — **do not mutate old repo** during audit export.
- [ ] Decide snapshot policy: **(A)** live frontend parity → include **`a5156ff`** + dirty overlay; **(B)** branch tip → **`effd130`** + dirty overlay (includes drawing cert not in live BUILD_ID until rebuild).
- [ ] Export **`dirty-path-classification.json`** filter: all `REQUIRED_BUT_NOT_COMMITTED` (228 paths) — verify list with engineering sign-off.
- [ ] **`pg_dump`** production DB (schema+data) to secure storage outside git — required for user/ledger continuity.
- [ ] Export **env var names** from `.env.production.example`; inventory current `.env` **keys only** (no values in tickets).
- [ ] Document live **image digests** (frontend `0f412e5…`, backend `cf33d68…`, admin `3e35a878…`).
- [ ] List **provider dashboards** to update (KMS, RPC, OAuth, webhooks) — see external dependencies doc.
- [ ] Confirm legal/ops approval to drop old git history (`m-live`, `metherium_final_v.1`).

---

## DURING COPY (Option B — curated tree)

- [ ] Create empty target directory on build host (not `/opt/m-live` if old stack still running).
- [ ] Copy tracked files: `git archive effd130` (or `a5156ff`) → extract to target **OR** `rsync -a --exclude-from=exclude.txt` from VPS.
- [ ] **Overlay** each of 228 REQUIRED paths from live `/opt/m-live` (modified + untracked under `apps/`, `scripts/`, `infra/`).
- [ ] Apply **DO NOT COPY** exclusions: `.git`, `node_modules`, `.env`, bundles, `backups/`, `.build/` (optional), `release-freeze-*`.
- [ ] Verify `package-lock.json`, `docker-compose.production.yml`, `apps/backend/src/database/migrate.ts` present.
- [ ] Scan for accidental secrets: `grep -R "BEGIN PRIVATE KEY"`, `.env` copies — **abort if found**.

---

## AFTER COPY (new Git repository)

- [ ] `git init` in target; set default branch (`main` or `release/exchange-production-baseline`).
- [ ] Single **initial commit** containing full curated tree (228 dirty paths included).
- [ ] Add new remote (FDA Exchange org/repo) — **do not** push to `Naman-Nadcab/m-live`.
- [ ] Update root `README.md` product name; optional rename `package.json` `"name"`.
- [ ] Rewrite `.github/workflows/production.yml`: branch trigger, `IMAGE_PREFIX`, secrets.
- [ ] Replace **`m-live-*`** image naming in docs/scripts or standardize on GHCR path.
- [ ] Run **`npm ci`** locally/CI — confirm lockfile integrity.
- [ ] Run **`npm run build`** (backend, frontend, admin) — record failures as blockers.

---

## BEFORE FIRST DEPLOY (fresh VPS)

- [ ] Provision VPS: Docker, compose, firewall, SSH.
- [ ] Clone **new** repo to chosen path; set `COMPOSE_PROJECT_DIR`.
- [ ] Create `.env` from `.env.production.example`; fill `vps-first-boot.sh` required vars; **rotate** secrets vs old VPS.
- [ ] Configure KMS/IAM for new instance.
- [ ] TLS: self-signed or real certs in `nginx/ssl/`.
- [ ] Either: **restore pg_dump** to new postgres volume **OR** accept empty DB → migrate → seed-admin.
- [ ] Decide compose **project name** (volume migration vs greenfield).

---

## AFTER FIRST DEPLOY

- [ ] `bash scripts/vps-first-boot.sh` (or staged: infra → migrate → seed → up).
- [ ] Smoke: `GET /health` 200; dependencies up.
- [ ] Smoke: `/forex/trade` 200; capabilities MOCK as expected.
- [ ] Smoke: spot public/markets; admin login with seeded 2FA.
- [ ] Record new **image digests** + git SHA in new `.deploy-rev` or equivalent.
- [ ] Update DNS / `PUBLIC_*` / OAuth / webhooks to new IP/domain.
- [ ] Decommission old repo access only after parallel run window — **out of scope for read-only audit**.

---

## Verification matrix (minimal)

| Check | Pass criterion |
|-------|----------------|
| Schema | 221± tables; `forex_accounts` exists |
| Crypto engine | matching-engine healthy in `/health` |
| Forex | capabilities API returns contract version |
| No secret in git | `git secrets` / manual scan clean |
| Dirty parity | 228 paths present in new initial commit |

---

## Blockers summary (must resolve before copy)

1. Policy choice: **`a5156ff` vs `effd130`** for frontend semantics.  
2. **228 REQUIRED** uncommitted files must be in snapshot.  
3. **DB dump** if preserving users/ledger.  
4. **Secret rotation plan** — never copy `.env`.

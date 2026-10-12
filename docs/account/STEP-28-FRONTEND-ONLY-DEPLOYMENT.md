# STEP 28 — Secure frontend-only production deployment

This document records the deployment process and the result of this step. A workflow was added. Production was not changed.

## 1. Root cause of the SSH access problem

The Cursor Cloud Agent VM has no VPS private key. `~/.ssh` contains only `known_hosts`. `/root/.ssh` on that VM is empty. `ssh-agent` has no loaded key. `ssh root@169.58.39.2` therefore returns `Permission denied (publickey,password)`.

The key named in `docs/account/STEP-24-PRODUCTION-GO-LIVE.md` as `/root/.ssh/adb_exchange_deploy` is on the production server. It is the server's key for talking to GitHub. It is not a key this agent can use to log in.

The working production SSH path is GitHub Actions. `.github/workflows/production.yml` uses the `production` environment and these secret names:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_DEPLOY_PATH` (optional)
- `PUBLIC_HEALTH_URL` (optional)

This agent's GitHub token cannot read those secrets (`403 Resource not accessible by integration`). The new workflow uses the same names and the same `production` environment. The private key stays in GitHub. It is not written to the repository, printed, or requested in chat.

The SSH host key was recorded with `ssh-keyscan` and checked against the key already stored from the earlier connection:

`SHA256:LPQv0Wf2i7YpOkuz+UBDw0U244tU/NumiDo4v7zuHGc` (ED25519, `169.58.39.2`)

The new workflow passes that fingerprint to the SSH and SCP actions. Host-key checking is not disabled.

## 2. Existing deployment workflow risks

`.github/workflows/production.yml` is not a UI-only deploy:

- It builds backend, frontend, admin, indexer, and the matching engine.
- Its frontend build sets `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to `https://api.example.com` and `wss://api.example.com`.
- The deploy job runs `docker compose up -d --remove-orphans` for the whole file, which can recreate every service.
- The default path is `/opt/exchange`. The live application directory is `/opt/adb-exchange`.
- It does not pin the SSH host key.
- It runs on every push to `main`.

That workflow was not run.

## 3. Actual production baseline

Public checks from this agent, with TLS verification left on:

| Check | Result |
|---|---|
| `https://169.58.39.2/login` | HTTP 200 |
| `https://169.58.39.2/forex/account` | HTTP 200 |
| `https://169.58.39.2/health` | `status=healthy`. Database, Redis, NATS, matching engine, and indexer reported up |

No public endpoint returns the git SHA. The historical values `48f8070708fe051ea3e6ae2c777b6bf3cdf56214` and `4bb8e42a1772e45fcd16bfe8e072accd863cc7d4` were not treated as the live HEAD. The live HEAD is read only by the workflow's `INSPECT_ONLY` mode, which had not succeeded when this file was written. See section 16.

## 4. Source UI commit

- Branch: `cursor/forex-overview-saas-ui-fb5f`
- Commit: `1591905dc047f397a2e764ee81dbeb1a42c6b8d5`
- Parent: `4bb8e42a1772e45fcd16bfe8e072accd863cc7d4`
- Message: Color the Forex account overview so balances are easier to scan.

## 5. Compatibility and ancestry analysis

`1591905` is a descendant of both historical SHAs.

Against parent `4bb8e42`, `deployment/frontend-only-preflight.sh` accepts the range. The diff is the six frontend files in section 7.

Against `48f8070`, the same script rejects the range. That range also changes the backend, admin panel, indexer, nginx, Compose, and migrations. It is about 61 commits, not a UI-only fast-forward. Merging that branch into a server still on `48f8070` is refused by the workflow.

`ForexPortalKpiCard` gained an optional `tone` prop. Callers that omit it keep the previous card. The overview page does not call a new backend route. Locale keys were added in all three Forex catalogs. This is compatible with the backend at `4bb8e42`. It was not rebuilt on top of `48f8070` because that live SHA is not confirmed and an earlier cherry-pick of the overview file conflicted.

## 6. Final release commit

No separate production release commit was created. `1591905` is the candidate release only when the live HEAD is exactly its parent, `4bb8e42a1772e45fcd16bfe8e072accd863cc7d4`. The workflow will not deploy it onto any other SHA.

## 7. Exact frontend files included

Relative to `4bb8e42`:

- `apps/frontend/messages/en/forex.json`
- `apps/frontend/messages/id-ID/forex.json`
- `apps/frontend/messages/zh-CN/forex.json`
- `apps/frontend/src/app/globals.css`
- `apps/frontend/src/components/forex/ForexAccountOverviewDashboard.tsx`
- `apps/frontend/src/components/forex/ForexPortalKpiCard.tsx`

The new workflow and this document are not part of that diff. They are not sent to production unless a later release SHA includes them, and the preflight would reject them because they are outside `apps/frontend/`.

## 8. Build-time API configuration

Confirmed in source:

- `docker-compose.production.yml` build args: `NEXT_PUBLIC_API_URL` from `PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` from `PUBLIC_WS_URL`, `NEXT_PUBLIC_ADMIN_PANEL_URL` from `PUBLIC_ADMIN_URL`.
- `apps/frontend/Dockerfile` promotes those build args to environment variables before `npm run build`.
- `apps/frontend/next.config.js` rewrites `/api/v1/*` to `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_API_URL`, and falls back to `http://localhost:4000` only when both are empty.
- `apps/frontend/src/lib/getApiUrl.ts` uses the same variables and returns same-origin when the page host matches the API host.

The frontend-only command builds on the VPS, so Compose reads the existing production `.env`. The workflow does not pass `api.example.com` and does not print `.env`. Before a build, the remote script rejects an empty `PUBLIC_API_URL` or `PUBLIC_WS_URL`, and rejects values containing `api.example.com`, `CHANGE_ME`, or `localhost`. After the build it searches the compiled app for `api.example.com` and rolls the frontend back if that string is present.

## 9. Workflow and protected secrets

Workflow: `.github/workflows/deploy-frontend-only.yml`

Trigger: `workflow_dispatch` only. It does not run on push.

Confirmation input:

- `INSPECT_ONLY` reads HEAD, working tree, and container state, then exits.
- `DEPLOY_FRONTEND_ONLY` is the only value that can rebuild the frontend.
- `ROLLBACK_FRONTEND_ONLY` restores the tagged previous frontend image.

Secrets used, by name only: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and optional `VPS_DEPLOY_PATH`. An empty deploy path means `/opt/adb-exchange`. The job uses the `production` environment.

## 10. Previous frontend image ID

Not recorded. Recording happens on the server immediately before a build, into `/var/tmp/adb-frontend-step28-rollback.env` and the local tag `adb-frontend-step28-previous:local`. No build ran.

## 11. New frontend image ID

None. The frontend image was not rebuilt.

## 12. Containers changed

None.

## 13. Containers deliberately left untouched

`exchange-backend`, `exchange-postgres`, `exchange-redis`, `exchange-nats`, `exchange-matching-engine`, `exchange-admin`, `exchange-nginx`, `exchange-indexer`, `exchange-rabbitmq`.

The allowed runtime command is `docker compose -f docker-compose.production.yml up -d --build --no-deps frontend`. `--no-deps` does not start or recreate dependencies. Nginx resolves `frontend` through Docker's DNS (`resolver 127.0.0.11`), so a replaced frontend container does not require an nginx restart. The remote script compares `StartedAt` for every other container and rolls the frontend back if any of them changed.

## 14. Post-deployment health results

Not applicable. Deployment did not run.

The public health check above was a read of the current live stack, not a post-deploy check.

## 15. Rollback procedure

Before a build, the remote script tags the running frontend image as `adb-frontend-step28-previous:local` and writes the image ID and Compose image name to `/var/tmp/adb-frontend-step28-rollback.env`.

On a failed health check, an `api.example.com` string in the build, or a changed unrelated container, the script points the Compose image tag back at that image ID and runs:

`docker compose -f docker-compose.production.yml up -d --no-deps --no-build frontend`

The same restore is `ROLLBACK_FRONTEND_ONLY`. It does not migrate, and it does not recreate the backend, database, Redis, NATS, admin, or matching engine. The previous image is not deleted.

This rollback path is in the script. It has not been executed against production.

## 16. Remaining blocker

Production was not mutated.

The live git SHA is still unknown from this agent because the VPS private key is only available to GitHub Actions. The smallest safe next action is to run this workflow with confirmation `INSPECT_ONLY`. That prints `PRODUCTION_HEAD` and container image IDs and stops.

If that HEAD is `4bb8e42a1772e45fcd16bfe8e072accd863cc7d4`, a second run can deploy release `1591905dc047f397a2e764ee81dbeb1a42c6b8d5` with confirmation `DEPLOY_FRONTEND_ONLY`.

If that HEAD is `48f8070708fe051ea3e6ae2c777b6bf3cdf56214`, do not deploy `1591905`. Port the six frontend files onto that SHA as a new release commit, then run the workflow only when `expected_production_sha` is the live HEAD.

If `INSPECT_ONLY` fails before SSH, the missing piece is the `production` environment secrets listed in section 9. Do not paste a private key into chat.

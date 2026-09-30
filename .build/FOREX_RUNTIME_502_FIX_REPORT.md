# Forex runtime 502 fix report

**FINAL STATUS:** `RUNTIME_HEALTHY`

## 1. Why nginx returned 502

Nginx resolved the `frontend` upstream to a **stale container IP** (`172.19.0.6:3000`) after `exchange-frontend` was recreated. That IP then belonged to **backend** (port 4000), so connections to port **3000** failed with **connection refused** → **502 Bad Gateway**.

Evidence (nginx error log):

`connect() failed (111: Connection refused) while connecting to upstream … upstream: "http://172.19.0.6:3000/"`

## 2. Exact broken upstream

**NGINX** → **`user_frontend` / `frontend:3000`** → **`exchange-frontend`** → **connection refused (wrong/stale IP)**

## 3. Exact broken Docker network/service relationship

Merged **`docker-compose.yml` + `docker-compose.production.yml`** had:

- Conflicting **`default` network** definitions (`exchange-network` vs `exchange-production`).
- **`exchange-backend`** not declared on **`exchange-production`** in compose (required for **`matching-engine`** / **NATS**).
- **`exchange-postgres`** recreated with **no network attachment** after port-binding conflicts.
- **Duplicate host port maps** on **4000/tcp** when both compose files published backend ports.

## 4. Root configuration mistake

1. Static nginx **`upstream { server frontend:3000; }`** caches DNS at load time (unsafe with Docker recreates).
2. Compose merge **without explicit dual-network** on postgres/redis/rabbitmq/frontend/backend.
3. **Dual `ports:`** entries for backend (and postgres) across merged files.
4. Base **`docker-compose.yml` nginx** mounted **`nginx.conf`** as a file, blocking production **entrypoint** from installing HTTP-only config (`cp: can't create '/etc/nginx/nginx.conf': File exists`).

## 5. Permanent compose/config fix

- **`nginx/nginx.http-only.conf`** and **`nginx/nginx.tls.conf`**: Docker embedded DNS **`resolver 127.0.0.11`** + variable **`proxy_pass`** (re-resolve service names after recreates).
- **`docker-compose.yml`**: explicit **`exchange-network`** + **`exchange-production`** (external) on backend, frontend, nginx, postgres, redis, rabbitmq; nginx uses production entrypoint volumes; removed duplicate backend/postgres host ports.
- **`docker-compose.production.yml`**: backend + data/front services on **`default` + `exchange_network`**; single backend **`4000:4000`** publish.

## 6. Services restarted

Recreated (no volumes removed): **postgres, redis, rabbitmq, backend, frontend, nginx**.

Not destroyed/restarted unnecessarily: **matching-engine, nats, postgres_data volume**.

## 7. No DB/data destruction

No **`docker compose down -v`**. Postgres volume **`postgres_data`** retained.

## 8. Current Docker health

`exchange-backend`, `exchange-frontend`, `exchange-nginx`, `exchange-postgres`, `exchange-matching-engine` — **healthy** (compose ps).

## 9. Current HTTP health

| Check | Result |
|-------|--------|
| `http://127.0.0.1/` (nginx) | **200** |
| `http://127.0.0.1/forex/account/accounts` | **200** |
| `http://127.0.0.1:4000/health/live` | **200** alive |

## 10. Frontend BUILD_ID

`6r5H2A35NyKqzCYkrJE05`

## 11. Backend image

`m-live-backend@sha256:cf33d68b2eec76f5a1d8f50289ff942d4a509303cdea5f50df7a0f0786f6569a`

## 12. GET /accounts result

Authenticated **`GET /api/v1/forex/accounts`**: **2** accounts, **`cardSnapshot` on all**.

## 13. Accounts Center result

**`/forex/account/accounts`** via nginx: **HTTP 200**.

## 14. Account Detail result

**`/forex/account/accounts/<validAccountId>`**: **HTTP 200**.

## 15. IDOR smoke result

Foreign account id via API: **404**.

## 16. Git commit

`52d282155125b23e3b7819698f17c88927055465` — `fix(infra): persist forex runtime network wiring`

## 17. Git remote sync

**YES** — `HEAD == origin/release/exchange-production-baseline`

## Deployment version

| | |
|--|--|
| **SOURCE COMMIT (images unchanged)** | `01cef224c8d9e545b0086eadea78619d8dea2ebb` |
| **Frontend digest** | `sha256:1d0e3858e8bc59faa6a38fde2654048854f7aaff3357d08e53e91ae7dc4986a0` |
| **Backend digest** | `sha256:cf33d68b2eec76f5a1d8f50289ff942d4a509303cdea5f50df7a0f0786f6569a` |

Infra-only commit adds compose/nginx persistence; application images unchanged from prior deploy.

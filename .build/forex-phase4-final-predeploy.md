# Phase 4/5 — predeploy (pending)

**When deploying WS + risk bar fixes:**

| Item | Value |
|------|--------|
| Git HEAD | `7f0bf68e753969778683e04b19d43bc78014d02d` + local Forex-only diffs |
| Services | `exchange-backend`, `exchange-frontend` |
| Migrations | None expected |
| REAL_FOREX | Must remain OFF |
| Crypto | Verify SHA before/after |

Files changed (Forex-only):

- `apps/backend/src/services/forex/auth/forex-authenticate.ts`
- `apps/backend/src/routes/forex.fastify.ts`
- `apps/frontend/src/components/forex/ForexRiskBar.tsx`

After deploy: re-run `scripts/forex-phase4-live-green-cert.mjs` when session open.

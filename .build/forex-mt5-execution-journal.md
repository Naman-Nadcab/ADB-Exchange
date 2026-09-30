# Forex MT5-class execution journal

**Started:** 2026-09-17  
**Git SHA (baseline):** `8ef599983974e84679bf44010ca3d8154785665a`  
**WIP:** preserved (230+ paths)  
**Cert DB:** `exchange_forex_cert` only for migrations  

## Phase log

| Phase | Action | Result |
|-------|--------|--------|
| Inventory | `forex-mt5-admin-inventory.ts` | `.build/forex-mt5-admin-inventory.json` (37 pages, 58 forex tables) |
| Checkpoints | Git tags `FOREX_*_BASELINE`, `FOREX_RELEASE_CANDIDATE` | Created on current HEAD |
| DB | MT5 ops plane tables | Migrated in cert container |
| Backend | `admin-forex-ops.fastify.ts` + services | Build PASS |
| RBAC | dealer / senior_dealer / sales / operations roles | `admin-rbac-routes.ts` |
| UI | notifications, compliance, automation pages + dealing MOCK actions | Admin build PASS |
| Cert migrate | `docker exec forex-cert-backend npx tsx src/database/migrate.ts` | PASS |

## BLOCKED (safety)

| Action | Reason | Alternative |
|--------|--------|-------------|
| Production DB migrate | Safety override | Cert container only |
| Host-side cert migrate | `postgres` hostname not reachable from host | Docker exec |
| REAL_FOREX / live LP | Master prompt §0 | MOCK + NOT_CONNECTED |
| Full Crypto regression staging | No isolated staging book | Ph 1,2,11,13 @ :4100 prior pass |

## Next loop

- Expand Playwright functional workflows (CRM create, dealer reject, compliance case)
- Finance request ledger posting on approval execute
- Re-run 164 IDOR + cert suites after ops routes
- Full Crypto regression when staging exists

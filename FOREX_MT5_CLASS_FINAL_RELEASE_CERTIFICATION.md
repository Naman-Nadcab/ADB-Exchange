# FOREX MT5-CLASS — RELEASE CERTIFICATION (pass 1)

**Date:** 2026-09-17  
**Branch:** `release/exchange-production-baseline`  
**Baseline SHA:** `8ef599983974e84679bf44010ca3d8154785665a` (WIP on top)  
**Cert API:** `http://127.0.0.1:4100`  
**Cert DB:** `exchange_forex_cert`  
**REAL_FOREX:** `false` (MOCK/SIMULATED)  

## Scope delivered (this pass)

- MT5-class **ops plane** DB tables (dealing actions, notifications, finance requests, automation, compliance cases)
- **`admin-forex-ops.fastify.ts`** — search, notifications, dealing accept/reject (MOCK), finance requests (maker-checker), automation, compliance
- **UI:** `/forex/notifications`, `/forex/compliance`, `/forex/automation`; dealing desk MOCK actions
- **RBAC:** dealer, senior_dealer, dealer_manager, sales, operations, ib_manager, technical_admin
- **Inventory:** `.build/forex-mt5-admin-inventory.json`
- **Checkpoints:** git tags `FOREX_*_BASELINE`, `FOREX_RELEASE_CANDIDATE`

## Builds

| Artifact | Status |
|----------|--------|
| Backend `tsc` | PASS |
| Admin panel `next build` | PASS |
| Cert migrations (container) | PASS |

## Certification (stale until re-run)

Re-run after this pass: runtime suite, API suite, live journey, IDOR 164, Playwright API/UI, Crypto ph1–15 on staging.

Prior evidence (pre–ops plane): UI nav 30/30, API smoke 22/22, IDOR 164/164, journey 48/48.

## Crypto safety

No changes to Crypto matching, `user_balances`, `balance_ledger`, P2P escrow, or withdrawal execution in this pass.

## FINAL VERDICT

**TIER-1 FOREX ADMIN/CRM IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED**

(Blockers: full Crypto regression staging; post-change cert harness re-run; finance ledger execute on approval; many MT5 domains still PARTIAL/FUTURE/NOT_CONNECTED — see `FOREX_MT5_CLASS_FINAL_MATRIX.md`.)

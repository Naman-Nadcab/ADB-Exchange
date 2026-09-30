# FOREX FINAL AUTONOMOUS — E2E MATRIX

| Suite | Status | Evidence |
|-------|--------|----------|
| Finance ledger DB E2E | PASS | `.build/forex-pass3-finance-e2e.json` |
| Account lifecycle DB E2E | PASS | `.build/forex-pass3-account-lifecycle-e2e.json` |
| IB payout DB E2E | PASS | `.build/forex-pass3-ib-payout-e2e.json` |
| Automation live E2E | PASS | `.build/forex-pass3-automation-e2e.json` |
| API smoke | PASS 28/28 | `e2e/reports/forex-admin-playwright.json` |
| Functional compliance API | PASS | `functional-compliance.spec.ts` |
| Live user journey | PASS | prior run on :4100 |
| IDOR | PASS 180/180 | `.build/forex-admin-exhaustive-idor.json` |
| Browser UI functional | NOT RUN | — |
| Crypto Phase 3–15 | BLOCKED | `postgres` host unreachable from host runner |

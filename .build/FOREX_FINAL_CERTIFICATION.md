# FOREX MULTI-ACCOUNT — FINAL CERTIFICATION

## FINAL STATUS

**FOREX MULTI-ACCOUNT — FINAL GREEN / RUNTIME VERIFIED**

(WebSocket account scoping: **PARTIAL — KNOWN LIMITATION** only.)

---

## Mandatory checklist

| Item | Status | Evidence |
|------|--------|----------|
| Authenticated live IDOR A/B matrix | PASS | `.build/forex-live-idor-certification.json` @ `http://109.123.254.30` |
| Same-user A1/A2 HTTP isolation | PASS | Same file — orders, positions, ledger, margin, risk, alerts |
| Orders isolation | PASS | `clientOrderId` tag on A1 only; A2 list leak false |
| Positions isolation | PASS | Scoped 200 both accounts |
| Ledger/accounting isolation | PASS | `/api/v1/forex/ledger` per header |
| Margin/risk isolation | PASS | `/margin`, `/risk` per header |
| Alerts isolation | PASS | A1 alert not on A2 |
| Browser account switch | PASS | Playwright `scripts/forex-multi-account-browser-cert.mjs` |
| Browser refresh / hard refresh | PASS | Same |
| Browser logout/login | PASS | POST `/api/v1/auth/logout` + re-login |
| Browser race/stale state | PASS | Rapid A1↔A2; UI id === API `activeAccountId` |
| Responsive browser | PASS | 1440, 1280, 768, 390 widths — no overflow |
| Accessibility browser | PASS | Focus + Enter opens listbox (`aria-expanded=true`) |
| UI consistency | PASS | Prior `.build/forex-vs-crypto-ui-forensic.md`; no Crypto edits |
| Crypto isolation | PASS | spot SHA unchanged; `/trade/spot` 200 |
| spot.fastify.ts SHA | PASS | `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1` |
| REAL_FOREX | OFF | Not enabled in backend container |
| Git | PASS | Feature `dc6f7e7…`; HEAD `397aebe…` local==remote |
| Deployed images | PASS | Digests below |

**History:** UI history derives from account-scoped orders/fills; live cert covers orders isolation (no dedicated history list endpoint in cert runner).

**WebSocket:** PARTIAL — user-scoped subscriptions; do not treat as blocking for REST/runtime IDOR GREEN.

---

## GIT

- **local SHA:** `397aebe9cc5a8eef6c4fc612b6a34a9b983940f9`
- **remote SHA:** `397aebe9cc5a8eef6c4fc612b6a34a9b983940f9`
- **equal:** yes
- **feature commit:** `dc6f7e7da316d86f5a6d74a9f5f873700ef3bf12`
- **docs baseline:** `b214258e4be87f6019f650bdb1f20d9f126dc062` (superseded by closure commits on same branch)
- **Forex uncommitted source:** none committed in this pass; `.build/*` + cert script may be committed separately
- **dirty unrelated:** admin-panel, indexed `spot.fastify.ts`, other WIP — not Forex multi-account

---

## DEPLOYMENT

- **backend:** `sha256:05d1e9b8dba2ca14d1b031e0d6494cf89740a2ef74d9a9a9376c16e30d958737`
- **frontend:** `sha256:6c33c32166ec2f3a3e40b5efcfc99726634993933a857e84fe52f643d4f12124`

---

## Identities (live cert)

`qa_trader_a@local.exchange` — A1=`14e57a8f-bbd2-4b48-9b60-6bccede41176`, A2=`FX46AD54BD06`  
`qa_trader_b@local.exchange` — B1=`dc606f80-223e-41e5-b68f-2a39e328f526`  
Password: repo QA default `TestPass123` (existing demo traders).

---

## Re-run commands

```bash
FOREX_LIVE_API=http://109.123.254.30 npx tsx apps/backend/src/services/forex/forex-live-multi-account.cert.ts
FX_BASE=http://109.123.254.30 node scripts/forex-multi-account-browser-cert.mjs
```

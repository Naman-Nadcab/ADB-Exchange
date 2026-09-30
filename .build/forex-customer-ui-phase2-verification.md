# Forex Customer UI — Phase 2 Verification

**Verdict: GREEN WITH EXPLICIT LIMITATIONS**

Phase 2 server-backed Forex alerts UI is **verified and frontend-only deployed**. This is not full end-to-end runtime certification of alert firing or external delivery.

## 1. Worktree

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| Ahead of remote | 78 |
| Tracked modified | ~110 files |
| Staged | none |

## 2. Change classification

### Forex-only (Phase 2 alerts UI)

- `ForexServerAlertsPanel.tsx` (new)
- `customer-alerts.ts` / `customer-alerts.test.ts` (new)
- `app/forex/alerts/page.tsx`
- `ForexBottomPanels.tsx` (terminal Alerts tab)
- `lib/forex/api/client.ts` (`alertEvents`, `alertDeliveryStatus`)

### Shared

- None for this frontend-only ship.

### Crypto

- **Only** `apps/backend/src/routes/spot.fastify.ts` modified among Crypto routes.
- Diff is **Crypto ticker/stale snapshot** logic — **no Forex**.
- Working tree file SHA256: `925ceffc…` (matches expected on-disk fingerprint).
- HEAD blob differs (`de501398…` at commit) — **pre-existing dirty state**.
- **Backend not redeployed** — running Crypto API unchanged.

## 3. Alert flow

Single panel state: `reload()` → `listAlerts` + `alertEvents` + `alertDeliveryStatus`.

CREATE → POST → DB → list refresh → ENABLE/DISABLE PATCH → DELETE → confirmed via API and browser on `/forex/alerts`.

Local alerts: `localStorage` + terminal-only copy; not server alerts.

## 4. Alert types (14 = backend ALLOWED = UI)

All types in `FOREX_SERVER_ALERT_TYPES` match backend `ALLOWED`. See `.build/forex-customer-ui-phase2-verification.json` for full matrix.

## 5–6. Events & delivery

- Events: authenticated, account-scoped; empty state honest.
- Delivery: WEB **AVAILABLE**; PUSH/EMAIL/WEBHOOK **NOT_CONFIGURED** with server reasons.
- Verification fix: UI uses `labelDeliveryAdapterStatus` (no fake SENT/DELIVERED on adapter strip).

## 7–8. Routes

- `/forex/alerts`: server alerts primary; **Local only** badge.
- Terminal: same `ForexServerAlertsPanel` (compact) + local section.

## 9. Security

- User B **DELETE** on User A alert → **404**.
- Events listed per authenticated Forex account.

## 10–11. Tests & build

| Test | Result |
|------|--------|
| `customer-alerts.test.ts` | PASS |
| `forex-workstation-ui.test.ts` | PASS |
| `npm run build` (frontend) | PASS |

## 12. Browser

- Login + `/forex/alerts`: types, list, create controls, local-only messaging.
- API E2E: create → disable → enable → delete **PASS**.
- Crypto: `/markets`, `/trade/spot` load; no Forex alert panel outside `/forex/*`.

## 13. Deployment (frontend only)

| | Digest |
|--|--------|
| **Before** | `sha256:78a0589f476d158ed0ed8208ce0f275ddbff8ba48f3fc44fb5784cf492bbf9ad` |
| **After** | `sha256:384ff1b0b8451703c32f2dec1f2d6be9960a54f957451e8012e52600b7138bbb` |

`exchange-frontend` recreated, **healthy**. Backend/matching/DB **not** restarted.

## 14. Crypto isolation

- No frontend Crypto route changes in Phase 2 scope.
- `spot.fastify.ts` dirty only in worktree; not shipped.

## 15. REAL_FOREX

**OFF** (env unset on running backend; contract `realForex: false` in source).

## Deferred (not counted as failures)

VWAP, Std Dev, Heikin Ashi, Renko, alert PATCH condition editing, **MARKET_DEPENDENT** runtime certification.

## Remaining limitations

- Alert **trigger** and **delivery audit** not proven without runtime/market events.
- Backend allows empty price conditions on BID/ASK/PRICE create.
- Large unrelated dirty branch; commit/deploy hygiene separate from this UI ship.

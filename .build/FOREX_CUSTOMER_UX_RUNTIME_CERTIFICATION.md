# Forex Customer Portal IA — Runtime Certification

**Last updated:** 2026-09-23 (staging frontend redeploy + `:80` parity gate)  
**Source SHA (git):** `40fd5ad6665278222108b43385f5833ac36359d4`  
**Branch:** `release/exchange-production-baseline`  
**Pass type:** Deployment + runtime verification (no app source commits)

---

## Certification decision

### **IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED**

Staging **now serves** a new frontend image built from workspace source at `40fd5ad`. **Portal IA route matrix, top-nav gate, terminal nav isolation, mobile Portal drawer, locale portal labels, and Crypto isolation PASS** on `http://127.0.0.1`.

**Not FULLY VERIFIED** because:

1. **Browser console / hydration:** Many `pageerror` (React #418/#423/#425) during authenticated navigation; numerous `MISSING_MESSAGE` console errors on `/forex/alerts` (pre-existing i18n key path `forex.serverAlerts.serverAlerts.*` — not modified in this pass).
2. **ForexAccountSwitcher / multi-account:** Not visible after staging HTTP login in gate run (`switcherVisible: false`); account switch and portal↔terminal↔portal flows **not certified**.
3. **Terminal depth checks:** Watchlist **present**; order ticket / risk bar locators **false** on desktop run (ticket is `lg:`-hidden; risk bar may require auth/trading state — not a confirmed terminal regression).

---

## 1. Git precheck

| Check | Result |
|--------|--------|
| Branch | `release/exchange-production-baseline` |
| `HEAD` | `40fd5ad6665278222108b43385f5833ac36359d4` |
| `origin/release/exchange-production-baseline` | `40fd5ad6665278222108b43385f5833ac36359d4` |
| App source modified in deploy pass | **No** (only this evidence doc updated) |

---

## 2. Staging frontend deployment

### Before (stale IA)

| Field | Value |
|--------|--------|
| Container ID | `0c54ae0b0cb74d3c1535e61c01d5800112490411adca9a96f17792196f312503` |
| Image | `sha256:700f3df9a1639f13ff2e6004bce0773726d79a2ccad025c28083d23f1b2e5b9f` |
| BUILD_ID | `WS9aip22Go_f19yESYZXf` |
| IA on `:80` | **7-item** top nav (Analysis / Alerts / Account in header) |

### After (40fd5ad workspace build)

| Field | Value |
|--------|--------|
| Action | `docker compose build frontend` → `docker compose up -d --no-deps frontend` |
| Container ID | `6932909d7730b80f8647393bb94ceabc29464f4e44099695bbdd0ad1e6244133` |
| Image | `sha256:36c7c64bf8ab1c790ff63a355666fc2146a84b071c151828bf1084930125ecc2` |
| Image created | `2026-09-23T16:33:31+02:00` |
| BUILD_ID (container) | **`vHHdBt0__pDaTLqpNBkUb`** |
| Served via | `http://127.0.0.1` (nginx → `exchange-frontend`) |

**SSR proof (post-deploy):** `/forex/account` header links are Trade/Markets/Portfolio/Orders only; portal row includes Overview / Account Ledger / Research / Tools (no Analysis/Alerts/Account in top nav).

---

## 3. Database / stack safety

| Service | Restarted? | Evidence |
|---------|------------|----------|
| `exchange-postgres` | **No** | `Started=2026-09-21T20:05:11Z` (unchanged) |
| `exchange-backend` | **No** | `Started=2026-09-23T11:25:29Z` (unchanged during frontend-only recreate) |
| Migrations / schema | **None** | Frontend-only deploy |

---

## 4. Primary staging IA matrix (`http://127.0.0.1`, Playwright)

All listed routes **HTTP 200**, portal subnav visible, **`topBad: false`** (no Analysis/Alerts/Account in top nav).

| Route | Active state | `activeOk` |
|-------|----------------|------------|
| `/forex/account` | Overview | **true** |
| `/forex/account/accounts` | Accounts | **true** |
| `/forex/account/funds` | Funds | **true** |
| `/forex/account/ledger` | Account Ledger | **true** |
| `/forex/analysis` | Research | **true** |
| `/forex/alerts` | Tools | **true** |
| `/forex/portfolio` | Portfolio (top nav) | **true** |
| `/forex/orders` | Orders (top nav) | **true** |
| `/forex/markets` | Markets (top nav) | **true** |

---

## 5. Terminal gate (`/forex`, `/forex/trade`)

| Check | `/forex` | `/forex/trade` |
|--------|----------|----------------|
| ForexPortalNav | absent | absent |
| Platform user menu | absent | absent |
| Watchlist | present | present |
| Portal on trade after CTA | — | absent (`portalOnTrade: false` in flow test) |

Order ticket / risk bar: **not asserted PASS** (locators false on desktop viewport; see decision § above).

---

## 6. Account context & multi-account

| Check | Result |
|--------|--------|
| Staging HTTP login (`loginUserForStagingHttp`) | Session established for route matrix |
| `ForexAccountSwitcher` visible on portal | **FAIL** (`switcherVisible: false`) |
| Multi-account switch | **NOT RUN** (no switcher) |
| Portal → terminal → portal | **PARTIAL** (terminal link opens `/forex/trade` without portal nav; account labels empty in report) |

**Follow-up:** Re-run with QA user that has ≥2 demo Forex accounts and confirm switcher label shows kind · currency · `#id`.

---

## 7. Mobile (`http://127.0.0.1`, iPhone 13 profile)

| Check | Result |
|--------|--------|
| Bottom tabs | Trade, Markets, Portfolio, Orders, **Portal** |
| Portal drawer | Overview, Accounts, Funds, Account Ledger, Research, Tools |
| Horizontal overflow | **false** |

---

## 8. i18n runtime (portal nav labels, `mlive_locale` helper)

| Locale | Active portal tab on `/forex/account` |
|--------|----------------------------------------|
| en | Overview |
| zh-CN | 概览 |
| id-ID | Ringkasan |

Portal navigation IA labels **render in selected locale**. (Separate alerts-page `MISSING_MESSAGE` noise remains — see §9.)

---

## 9. Console / hydration

**FAIL for “clean console” gate.**

Observed during parity run on `:80`:

- Multiple **React minified errors** (#418, #423, #425) — hydration-related during navigation.
- Many **`MISSING_MESSAGE: forex.serverAlerts.serverAlerts.*`** on `/forex/alerts` (English), likely pre-existing catalog/key-path issue; **not fixed** in this pass per scope.

Artifact: `/tmp/forex-staging-parity-report.json` (on gate host).

---

## 10. Crypto isolation

| Route | Forex portal nav present |
|-------|---------------------------|
| `/trade/spot` | **false** |
| `/dashboard` | **false** |
| `/wallet` | **false** |
| `/p2p` | **false** |

---

## 11. `forex-workstation-ui.test.ts`

**PRE-EXISTING** at `95fa5cd` and `40fd5ad` (`Orders page Modify` — literal `'Modify'` vs `to('modify')`). Not addressed in deploy pass.

---

## 12. FULLY VERIFIED checklist

| Gate | Status |
|------|--------|
| Staging serves 40fd5ad-built image | **PASS** |
| New BUILD_ID captured | **PASS** (`vHHdBt0__pDaTLqpNBkUb`) |
| Portal routes on `:80` | **PASS** |
| Top nav 4-item | **PASS** |
| Portal secondary nav | **PASS** |
| Terminal nav isolation | **PASS** |
| Account switch authenticated | **FAIL** |
| Portal ↔ terminal ↔ portal | **PARTIAL** |
| Mobile | **PASS** |
| en / zh-CN / id-ID portal labels | **PASS** |
| Crypto isolation | **PASS** |
| Console/hydration clean | **FAIL** |
| DB unchanged | **PASS** |

---

## 13. Historical note (pre-deploy)

Prior certification (same doc, earlier date) correctly blocked on stale BUILD_ID `WS9aip22Go_f19yESYZXf`. **That gap is closed** for IA serving; remaining blockers are runtime quality gates above.

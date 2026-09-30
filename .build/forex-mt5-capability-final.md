# Forex MT5-class capability — final certification

## Verdict: **GREEN WITH EXPLICIT LIMITATIONS**

Tier-0 / **MT5-class customer trading** coverage is **strong for simulated execution** (terminal, orders, positions, chart, alerts, account/risk, CSV). The platform is **not** MT5-equivalent for **multi-account customer UX**, **real funding**, **provider market data**, or **automation/copy/backtest/VPS** modules.

---

## 1–2. Capability matrix

Full audit: [forex-mt5-capability-audit.json](./forex-mt5-capability-audit.json) · [forex-mt5-capability-audit.md](./forex-mt5-capability-audit.md)

---

## 3–6. Multi-account (critical)

**ARCHITECTURE_DEPENDENT** — do not ship a switcher UI alone.

| Question | Answer |
|----------|--------|
| DB multiple accounts per user? | **Yes** (`forex_accounts.user_id`) |
| Customer API uses which account? | **`userId` as `accountId`** (`accountIdFromRequest`, `ensureAccount`) |
| Customer create/switch accounts? | **No** |
| Orders/positions/alerts/ledger scoped? | **Yes** (by `account_id` — equals login id today) |
| User B → User A data? | **Blocked** (401/404) |
| Demo 1 + Demo 2 without mixing (customer)? | **Not supported** until account API |

**Affected if multi-account ships:** all `forex-*` routes, accounting hydrate, WS private channels, alerts DB, demo funding, IDOR matrix, frontend store.

---

## 7–18. Domain summaries

| Domain | Status |
|--------|--------|
| Market Watch + contract spec | **GREEN** (spec dialog in watchlist) |
| Order execution matrix | **GREEN** (contract in `customer-contract.ts`) |
| Positions / account | **GREEN** (backend authoritative) |
| Chart / 21 indicators | **GREEN**; VWAP **DATA_DEPENDENT**; Heikin/Renko **ARCHITECTURE_DEPENDENT** |
| Drawings | **GREEN** |
| Toolbox surfaces | **GREEN** (trade, orders, history, alerts, journal, etc.) |
| Reporting | **PARTIAL** — CSV **GREEN**; statements / equity curve **MISSING** |
| Alerts | **GREEN**; push/email/webhook **PROVIDER_DEPENDENT** |
| News / calendar | **PROVIDER_DEPENDENT** |
| DOM / tape | **PROVIDER_DEPENDENT** (simulated/unavailable honest) |
| Mobile | **PARTIAL** (companion tabs) |
| Automation / backtest / copy / VPS | **MISSING** (audit only; WS `fx.copy` reserved) |
| Security | **GREEN** for single-account model; multi-account **untested** |

---

## 19. Implemented changes (this phase)

- **`/forex/account`**: shows server **account ID** and explicit copy that **one Forex context per login** applies; multi-account switching waits on customer account API.
- **No** backend changes. **No** multi-account switcher.

---

## 20–22. Tests · Crypto · Deploy

| Test | Result |
|------|--------|
| `customer-alerts.test.ts` | PASS |
| `forex-workstation-ui.test.ts` | PASS |
| Frontend build | PASS |

- **`spot.fastify.ts`**: not edited this phase (pre-existing dirty unchanged).
- **Backend**: not deployed.
- **Frontend**: deploy after build if digest updated (see deploy log on host).

---

## 23–28. Status

| Item | Value |
|------|--------|
| REAL_FOREX | **OFF** |
| Crypto | **Frozen** |
| Prior frontend digest | `sha256:630100fc…73324438` |
| Remaining | Multi-account API, VWAP volume, Heikin/Renko, providers, market runtime, backend deploy gate |

JSON: [forex-mt5-capability-final.json](./forex-mt5-capability-final.json)

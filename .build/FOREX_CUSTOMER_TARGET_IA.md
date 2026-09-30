# Forex Customer Target Information Architecture

**Baseline audit:** `0c37409` · Independent recommendation (does not assume prior IA is final).

---

## 1. Principles

1. **Account context is global** — every private view is for the **active** Forex account unless on account detail preview.
2. **Trading speed stays in terminal** — portal manages money, history, configuration, research.
3. **Demo ≠ Live** — navigation labels and CTAs branch on `accountKind` / `realForex`.
4. **Platform security is shared** — KYC/2FA live under platform profile, linked from Forex chrome.

---

## 2. Recommended primary navigation

### Header (always on Forex)

| Item | Route | Role |
|------|-------|------|
| Trade | `/forex/trade` | Terminal entry |
| Markets | `/forex/markets` | Instrument discovery |
| Portfolio | `/forex/portfolio` | Open positions |
| Orders | `/forex/orders` | Order management + fills |

### Portal sub-nav (non-terminal)

| Item | Route | Role |
|------|-------|------|
| Overview | `/forex/account` | Dashboard |
| Accounts | `/forex/account/accounts` | Directory + detail entry |
| Funds | `/forex/account/funds` | Demo claim / future deposit-withdraw-transfer |
| Ledger | `/forex/account/ledger` | Accounting history |
| Research | `/forex/analysis` | Calendar, news, chart intel |
| Tools | `/forex/alerts` | Server alerts |

**Rationale:** Markets/Portfolio/Orders are **trading-adjacent** and belong in header for frequency. **Funds/Ledger** are **account-admin** and stay in portal strip (CXM-style separation of “trade” vs “money”).

---

## 3. Contextual / secondary

| Surface | Placement |
|---------|-----------|
| Account detail | `/forex/account/accounts/[accountId]` (new) |
| Trade history (optional) | Sub-route under Orders or `/forex/history` |
| Export downloads | Ledger + Orders actions |
| KYC / Security / Support | User menu → platform routes |
| Platform dashboard | User menu escape hatch |

---

## 4. Terminal-only (unchanged)

`/forex`, `/forex/trade` — full workstation: chart, watchlist, ticket, ticker, sessions, toolbox, account bar, journal, CSV export from toolbox.

---

## 5. Portal ↔ terminal shortcuts

| Portal action | Terminal destination |
|---------------|---------------------|
| Open terminal | `/forex/trade?symbol=` (preserve workspace symbol) |
| View positions | `/forex/portfolio` or terminal Positions tab |
| View orders | `/forex/orders` or terminal Orders tab |
| Markets analyze | `/forex/analysis?symbol=` |

---

## 6. Multi-account IA

| Page | Behavior |
|------|----------|
| Overview | Shows **active** account metrics; switcher changes cookie + rehydrate |
| Accounts | All accounts; switch inline |
| Account detail | One account metadata; financials require switch or read-only policy |
| Funds / Ledger | Always **active** account — show chip |
| Portfolio / Orders | Active account positions/orders |
| Terminal | Account bar switcher (frozen) |

---

## 7. Future Funds sub-IA (when live rails exist)

```
Funds
├── Overview (balances + pending)
├── Deposit      (account pre-selected)
├── Withdraw
├── Transfer
├── Payment methods
└── Activity (reuse funding table)
```

---

## 8. Profile & Security (platform, not Forex duplicate)

- Verification → `/dashboard/identity`
- Security / 2FA → `/dashboard/security`
- Support → `/dashboard/support`
- Help → `/dashboard/help`

Forex overview may show **read-only eligibility summary** with links—no duplicate KYC wizard.

---

## 9. IA gaps vs `0c37409`

| Gap | Recommendation |
|-----|----------------|
| No account detail route | Add `[accountId]` under Accounts |
| History not in nav | Add under Orders or Portal “History” |
| Deposit/Withdraw absent | Funds sub-routes when backend ready |
| No Forex dashboard entry besides Overview | Keep `/forex/account` as home; redirect `/forex` to terminal not portal |

---

## 10. Mobile IA

- **Bottom bar:** Trade · Markets · Portfolio · Orders · Portal (drawer).
- **Portal drawer:** full portal sub-nav + compact switcher.
- **Terminal mobile:** unchanged companion layout.

# Forex Customer Implementation Roadmap

**Baseline:** `0c37409` · Documentation only · No code in this audit.

Priorities: **P0** blocker for broker parity · **P1** high UX/product · **P2** live rails · **P3** polish · **P4** future.

---

## Phase A — Portal product completeness (UI-only, LOW risk)

| Item | Effort | Depends on |
|------|--------|------------|
| Account detail page shell `/forex/account/accounts/[accountId]` | M | `GET /accounts/:id` + switch for metrics |
| Wire `forexApi.getAccount(accountId)` wrapper | S | existing backend route |
| Active account context chip on all portal pages | S | switcher data |
| Overview: account completion / KYC checklist (platform API) | M | dashboard identity status API |
| Portal CSV export (reuse `downloadForexHistoryCsv`) on Ledger + Orders | S | existing export routes |
| Demote technical strings to `<details>` on Overview + Ledger reconciliation | S | i18n keys only |
| Funds: trading vs Crypto wallet education card | S | copy |
| Orders/Ledger: status badge pass | S | — |
| Account cards: show `createdAt`, leverage consistently | S | listAccounts fields |

**Outcome:** CXM-style **account hub** and **guidance** without backend funding rails.

---

## Phase B — Account lifecycle UX (LOW–MEDIUM risk)

| Item | Effort | Depends on |
|------|--------|------------|
| Demo vs Live conditional CTAs (hide deposit on demo) | S | accountKind |
| Suspended/restricted account banners from `status` + risk | M | risk/dealing |
| Position mode entry on account detail (reuse API) | M | flat-account guards |
| Optional portal read-only journal module | S | `/journal` |
| Dedicated Trade History nav (fills + export) | M | — |

---

## Phase C — Live account & funding (HIGH risk, provider/compliance)

| Item | Effort | Depends on |
|------|--------|------------|
| Customer live account application API | L | KYC, compliance, REAL_FOREX flag |
| Customer deposit API + provider webhooks | L | payment provider |
| Customer withdraw API (expose accounting.withdraw safely) | L | approval workflow, 2FA |
| Internal transfer policy + API | L | product/legal |
| Payment methods / beneficiaries (Forex-scoped) | L | provider |
| Funding pending/failed/rejected states in UI | M | rail events |
| Gate live actions on KYC tier + 2FA | M | platform security |

**Do not** enable until REAL_FOREX and compliance sign-off.

---

## Phase D — Advanced / future (MEDIUM–HIGH risk)

| Item | Notes |
|------|-------|
| Investor read-only access | New security model |
| Statements / tax PDFs | Provider + storage |
| Account closure | Backend workflow |
| Leverage change requests | Dealing desk integration |
| Push/EMAIL alert delivery | Adapter configuration |

---

## Change risk summary

| Area | Risk | Reason |
|------|------|--------|
| Portal visual / new pages | LOW | Isolated components |
| Account switcher / hydrate | MEDIUM | Must not break header/cookie |
| i18n new keys | LOW | Architecture unchanged |
| Terminal | **HIGH** | Frozen — no layout changes |
| Ledger/risk/execution BE | **HIGH** | Out of scope |
| Live funding rails | **HIGH** | Money movement + compliance |

---

## Suggested sequencing

1. **Phase A** (4–6 weeks product time): detail page + guidance + export + copy — achieves most **CXM-level clarity** on MOCK.
2. **Phase B** parallel polish.
3. **Phase C** only when business enables REAL_FOREX + provider contracts.
4. **Phase D** as roadmap items.

---

## Success metrics

- Customer can name **active account** and **Demo vs Live** from overview without reading technical footnotes.
- Customer can open **account detail** and reach **terminal, funds, ledger** in one click.
- Customer never confuses **Crypto wallet** with **Forex ledger balance** (survey/copy test).
- Live path (when enabled): deposit flow completes with **account pre-selected** and **KYC gate** clear.

---

## Must NOT change (regression guard)

- Terminal layout and components (`ForexTerminalLayout`, chart, ticket, watchlist, toolbox).
- Order execution, risk calculation, ledger posting logic.
- Crypto customer routes and wallet flows.
- DB schema migrations for portal-only work.
- i18n architecture (namespace pattern).

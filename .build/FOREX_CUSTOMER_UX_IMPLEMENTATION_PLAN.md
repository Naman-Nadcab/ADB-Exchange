# Forex Customer UX IA — Safe Implementation Sequence

**Audit-only predecessor:** `.build/FOREX_CUSTOMER_UX_IA_FRESH_AUDIT.md`  
**Constraint:** Terminal visual/function unchanged; crypto unchanged; backend/DB/i18n unchanged.

## Risk legend

- **LOW:** Navigation labels, ordering, links, conditional visibility, portal-only components  
- **MEDIUM:** Shared Forex shell changes on **non-trade** paths only (`forex-hub` class)  
- **HIGH:** `ForexTerminalLayout` trade branch, chart/ticket/bottom panels, route renames  

---

## Phase 1 — Navigation model decision (documentation + design sign-off)

**Risk: LOW**  
Deliverable: agreed **Hybrid D+C** model (see audit §D): keep **top nav** for terminal-first items; add **portal secondary nav** on `!isForexTradePath` only.

**Exit criteria:** Engineering agrees no sidebar on `/forex/trade` or `/forex` terminal paths.

---

## Phase 2 — Portal secondary navigation (non-terminal only)

**Risk: MEDIUM**  
Implement a **horizontal portal subnav** (or compact left rail ≤240px) visible when `ForexTerminalLayout` renders `{children}` (L184–186), grouping:

1. **Overview** → `/forex/account`  
2. **Accounts** → `/forex/account/accounts`  
3. **Funds** → `/forex/account/funds`, `/forex/account/ledger`  
4. **Activity** → `/forex/portfolio`, `/forex/orders`  
5. **Research** → `/forex/markets`, `/forex/analysis`  
6. **Tools** → `/forex/alerts`  

**Do not** remove `ForexTopNav` yet — reduce duplication gradually (e.g. demote Alerts from top nav after subnav exists).

---

## Phase 3 — Account context clarity

**Risk: LOW–MEDIUM**  
- Always show **ForexAccountSwitcher** in **top header on portal pages** (mirror bottom bar context).  
- Add persistent **“Viewing account #…”** banner on portal Activity pages when `activeForexAccountId` set.  
- No backend account behavior changes.

---

## Phase 4 — Portal home elevation (content, not terminal)

**Risk: LOW**  
Enhance `/forex/account` as **portal home** with prioritized blocks (audit §H): verification exit link (platform), demo funding CTA, open terminal, active account summary, conditional open positions count.

**Optional future route:** `/forex/home` → redirect to `/forex/account` (**LOW** risk redirect only).

---

## Phase 5 — Funding & guidance copy

**Risk: LOW**  
- Unify **demo funding** path: portal home + funds page + zero-balance terminal sign-in.  
- **Guidance pattern** on blocked actions: WHY / NEXT STEP / LINK (platform KYC when user hits auth walls).  
- Do not enable real deposit UI until product + compliance ready.

---

## Phase 6 — Activity labeling (orders vs positions vs history)

**Risk: LOW**  
- Rename top nav labels if needed (i18n keys only — **coordinate with i18n owners**; architecture first).  
- Cross-link portal Orders ↔ Terminal toolbox with same tab names.  
- Document: **Positions** = open exposure; **Orders** = working orders; **History** = fills/closed (terminal tab + orders completed).

---

## Phase 7 — Mobile portal navigation

**Risk: MEDIUM**  
Replace mobile **“More” → single account URL** with **portal drawer** listing Accounts, Funds, Research, Tools — keep **5 bottom tabs** for Trade, Markets, Portfolio, Orders, + **Portal** (not 8 tabs).

---

## Phase 8 — Research deduplication

**Risk: LOW**  
- Economic calendar: canonical **Analysis page**; terminal calendar tab = **shortcut** (CommandCenter already).  
- Optional demote Analysis from top nav to Research subnav after Phase 2.

---

## Phase 9 — Platform exit ramps (Forex shell only)

**Risk: LOW**  
Add **non-invasive** footer or user menu **inside ForexTopNav** for: Verification, Security, Support (links to existing `/dashboard/*`). **Does not change crypto IA** — single exit points for cross-cutting compliance.

---

## Phase 10 — Analytics & monitoring

**Risk: LOW**  
Track: portal subnav usage, account switch events, demo fund claims, terminal vs portal orders page hits.

---

## Explicitly deferred (no nav until built)

Live account opening, real deposit/withdraw, VPS, Copy/PAMM, promotions, MT downloads.

---

## Must not move (implementation guardrails)

- `/forex/trade` terminal grid, watchlist, ticket, bottom panels, risk bar  
- Order ticket / chart components  
- `useForexRuntime` / WS hydrate pipeline  
- Crypto product switcher behavior (only add Forex portal menu items if approved)

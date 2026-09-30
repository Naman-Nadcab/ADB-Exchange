# ADMIN CERTIFICATION GAP FORENSIC AUDIT

Read-only forensic pass — **no product code, RBAC, user, or DB mutations.**

## Git

| Field | Value |
|-------|--------|
| branch | `release/exchange-production-baseline` |
| HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| remote HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| match | **PASS** |

`spot.fastify.ts`: working tree `2ccdd1f…`, HEAD `0c4cdaaa…` — unchanged this phase.

## RBAC

### Safe verification mechanisms found (not all executed on production)

| Mechanism | Location | Production-safe? |
|-----------|----------|------------------|
| Playwright shell cert | `scripts/admin-shell-domain-cert.mjs` | Yes (read-only nav) |
| RBAC route unit matrix | `apps/backend/src/lib/admin-rbac-routes.test.ts` | Yes (no DB); **one assertion fails on current HEAD** (compliance PATCH `/settings/system`) — not repaired |
| Forex cert IDOR matrix | `apps/backend/scripts/forex-cert-idor-matrix.ts` | **Off-production** (`exchange_forex_cert`, API `:4100`) |
| Cert Playwright auth | `e2e/forex-admin/admin-cert-auth.ts` | Off-production identities |
| UI domain rules (static) | `apps/admin-panel/src/lib/admin/admin-domain.ts` | Code evidence only |

Production `admin_users` (read-only SELECT): **only** `super_admin` ×2 and `withdrawal_approver`. **No crypto-only or forex-only rows.**

### Role matrix results

| Role | Method | Control | Crypto | Forex | Direct routes | Result |
|------|--------|---------|--------|-------|---------------|--------|
| **Full** | Deployed browser cert | YES | YES | YES | allowed | **VERIFIED** |
| **Crypto-only** | — | — | — | — | — | **NOT_VERIFIED** — no identity |
| **Forex-only** | — | — | — | — | — | **NOT_VERIFIED** — no identity |
| **Control-only** | Login `approver@example.com` | — | — | — | — | **NOT_VERIFIED** — `INVALID_CREDENTIALS`; cannot guess password |

### Static shell vs “control-only” expectation (evidence, not runtime)

`withdrawal_approver` backend permission: `withdrawals:approve` only (`admin-rbac-routes.test.ts` L25–26).

UI domain gate includes `withdrawals:approve` in `CRYPTO_ACCESS` (`admin-domain.ts` L46–47). **Expected shell behavior for approver (if login worked): Control + Crypto tabs, no Forex** — not “Crypto hidden” as in a strict control-only matrix.

Backend: `withdrawal_approver` **GET `/withdrawals` denied** (test L43) but **POST approve allowed** — finance slice, not full crypto ops.

**Classification:** Production runtime matrix for B/C/D = **EVIDENCE GAP**. Shell “control-only” label for `withdrawal_approver` = **REAL DEFECT / design mismatch** vs certification matrix wording (role is finance-scoped, not control-plane-only).

---

## Emergency Controls

### Matrix (source-traced)

| Control | UI route | Domain | Backend route / service | Permission (pattern) | Label (UI) | Classification |
|---------|----------|--------|---------------------------|----------------------|------------|----------------|
| Safe mode | `/control-center` | **GLOBAL** (exchange-wide) | `POST /system/safe-mode` → `setTradingHalt` + `system_settings` | `settings:edit` via `^/(system\|settings\|control)` | “Safe mode” | **GLOBAL** (crypto halt keys; not Forex kill) |
| Spot trading halt | `/control-center` | **CRYPTO** | `POST /trading/halt` → `trading-halt.ts` Redis `trading_halt:global` | `markets:manage` | “Spot trading” | **CRYPTO** |
| Withdrawal pause | `/control-center` | **CRYPTO** | `PATCH /operational/wallet-status` | `control:commands` + operational pattern | “Withdrawals” | **CRYPTO** |
| P2P disable | `/control-center` | **CRYPTO** | `POST /system/emergency` | `settings:edit` | “P2P trading” | **CRYPTO** |
| Emergency levels / circuit / matching pause | `/admin-control` | **GLOBAL** (legacy exchange CP) | `/control/emergency-level`, `/control/circuit`, … | `control:commands` | “Trading Halt” L1–L3 | **GLOBAL** / **CRYPTO** engine |
| Liquidity kill | `/admin-control` | **CRYPTO** / MM | `POST /control/liquidity-kill` | `control:commands` | liquidity kill | **CRYPTO** |
| MM desk | `/admin/mm-control` | **CRYPTO** | mm-control routes | `^/(operations\|operational\|mm-control)` | MM | **CRYPTO** |
| Forex kill switch | `/forex/controls` | **FOREX** | `PATCH /forex/controls` `kill_switch` | `forex:controls:manage` | “Global kill switch” (Forex copy) | **FOREX** |
| Forex dealing halt | `/forex/dealing`, risk hubs | **FOREX** | `setForexEmergencyHalt` in `services/forex/risk/dealing.ts` | forex permissions | dealing/risk UI | **FOREX** |
| maintenance_mode | settings / DB key | **GLOBAL** | `system_settings.maintenance_mode` | settings | varies | **GLOBAL** |

**Execution performed:** **NO**

### Answers (evidence-based)

1. **Are Crypto controls incorrectly exposed under Control Center?**  
   **Partially by design, partially ambiguous.** `/control-center` intentionally hosts **crypto exchange** emergency toggles (spot halt, deposits, withdrawals, P2P) under the **Control Center workspace**, not under the Crypto tab. Backend targets confirm **crypto scope** (`trading-halt.ts`, `operational/wallet-status`). They are **not Forex controls**, but they **are crypto financial controls** shown in the shared shell.

2. **Are Forex controls incorrectly exposed under Control Center?**  
   **NO** (source). Forex kill switch is on **`/forex/controls`** with `forex:controls:manage` and `runtime-controls.ts` — not wired through `/control-center` safe mode.

3. **Are global controls legitimately global?**  
   **PARTIAL.** Safe mode and `/admin-control` emergency levels affect **exchange-wide** spot/settlement/matching infrastructure (`admin.fastify.ts`, `trading-halt.ts`). They do **not** flip Forex `killSwitch` in `runtime-controls.ts`. “Global” for crypto ≠ “global including Forex.”

4. **Is `/admin-control` a legacy/shared control plane?**  
   **YES** — comment in `admin-control.fastify.ts` L1–3; spot metrics, MM circuit, settlement; overlaps conceptually with `/control-center`.

5. **Is there duplication?**  
   **YES** — trading halt / emergency theming appears on both **`/control-center`** and **`/admin-control`** (and **`/settings/system`** global trading halt strings). Different API families (`/trading/halt` vs `/control/emergency-level`).

6. **Real domain-separation defect?**  
   **REAL DESIGN GAP** for **operator clarity and scoping**, not necessarily a single backend bug: crypto emergency surfaces live under **Control Center** navigation while Forex has a **separate** kill switch; **safe mode does not scope Forex**. Risk: operator assumes Forex halted when only spot Redis halt toggled. **Not fixed in this phase.**

**Emergency controls classification:** **REAL DESIGN GAP** (label/route/mental model), not **VERIFIED** as cleanly separated CRYPTO / FOREX / GLOBAL.

---

## Database

| Question | Finding |
|----------|---------|
| Migration this phase? | **No** — no migrate command; admin-only image rebuild |
| Schema mutation? | **No evidence** of ALTER in this phase |
| Financial mutation? | **No evidence** in this phase |
| Independent proof | **NOT VERIFIED** — no `schema_migrations` (or similar) in `public`; cannot prove absence of historical migrations from DB alone |
| Deployment evidence | `exchange-admin` created **2026-09-20T07:42:11Z**; backend logs grep showed **no** recent “migration” lines |

**DB proof classification:** **EVIDENCE GAP**

---

## Crypto safety (recheck)

| Item | Status |
|------|--------|
| spot.fastify.ts | unchanged |
| backend digest | `fe8179874d1b…` |
| frontend digest | `08c4cb9747fd…` |
| matching engine | `35f759eddf43…` |
| indexer | unchanged |
| Admin digest | `0b5d9980…` (expected deployed shell) |

---

## Final classification

| Gap | Classification |
|-----|----------------|
| **RBAC** (crypto/forex/control-only runtime) | **EVIDENCE GAP** |
| **RBAC** (shell vs withdrawal_approver “control-only”) | **REAL DEFECT** (matrix expectation vs `admin-domain.ts` + role permissions) |
| **Emergency controls** | **REAL DESIGN GAP** |
| **DB independent proof** | **EVIDENCE GAP** |

## Recommendation (no implementation in this phase)

1. **RBAC closure:** Use **off-production** `exchange_forex_cert` + `forex-cert-idor-matrix.ts` / cert E2E for **API** matrix; add **documented non-prod** crypto-only/forex-only fixtures OR controlled password rotation policy for **one** scoped prod test user — **separate controlled phase** (requires user approval; out of scope here).

2. **Emergency controls:** **Separate implementation phase** — scoped labels, route grouping (Crypto vs Forex vs Global), operator docs; trace that safe mode ≠ Forex kill. **Do not** conflate with Admin shell tab work.

3. **DB proof:** Optional **read-only** operational procedure (deploy log + `current_database()` + migration runner audit trail) — **no new tables** unless product approves.

## Final status

**PARTIAL** — Admin shell remains **VERIFIED** for full admin; remaining gaps are **EVIDENCE GAP** and/or **REAL DESIGN GAP**, not closed by this forensic pass.

**No code changes. No GO claim.**

JSON: `.build/ADMIN_CERTIFICATION_GAP_FORENSIC_AUDIT.json`

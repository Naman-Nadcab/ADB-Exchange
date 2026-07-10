# MOB-001B — Phase 1A Audit & Consistency Fixes

**Audit Date:** 2026-07-10  
**Reference:** `METHERIUM-MOBILE-PRODUCT-ARCHITECTURE-PHASE-1A.md`  
**Result:** **PASS with 6 additions** — Phase 1A internally consistent after amendments below.

---

## Verification Matrix

| Area | Phase 1A | Audit Result | Action |
|------|----------|--------------|--------|
| Navigation tree | §4 | PASS | No dead ends; AccountStack reachable |
| Feature inventory | §2 | PASS | All backend Current features mapped |
| Screen inventory | §3 | PASS + 6 additions | See §Additions |
| API mapping | §9 | PASS | All MVP screens have API path |
| User journeys | §5 | PASS | 11 personas complete |
| Component inventory | §8 | PASS | 95 base components |
| Deep links | §4.5 | PASS + 2 additions | Notifications, convert |
| Orphan screens | — | PASS | None after additions |

---

## Issues Found & Fixed

### 1. Missing Screens (added to 1B inventory)

| ID | Screen | Reason |
|----|--------|--------|
| S-007 | Rate limit / cooldown | API 429 UX not inventoried |
| S-123 | PIN app lock fallback | Journey §5.9 references PIN; no screen |
| S-124 | Legal document viewer | In-app privacy/terms without external browser |
| D-003 | Concurrent session warning | `logout-all-other` + multi-device |
| D-004 | Logout confirmation | Destructive action guard |
| D-005 | Discard unsaved form | Referenced in §4.7 back rules |

### 2. Duplicate Screens — None

- Orders spot vs trade open orders: **intentional** — Trade peek vs Orders hub full list (different context)
- Deposit hub S-510 vs wallet quick action: **same screen**, multiple entry points (valid)

### 3. Dead Navigation — None

All stacks terminate at tab root or AuthStack.

### 4. Missing Flows (now specified in 1B)

| Flow | Resolution |
|------|------------|
| Add identifier (email/phone mid-life) | S-701 → S-725 (new) |
| Withdraw email OTP step | W-510 step 3 uses D-903 |
| Convert limit order cancel | S-542 → D-502 (new) |
| Push notification cold start | §4.5 + S-773 routing |
| Telegram OAuth link | S-703 action sheet |

### 5. New Screens from Flow Gaps

| ID | Screen |
|----|--------|
| S-725 | Add identifier (email/phone) |
| D-502 | Cancel convert limit order |

### 6. Hidden Edge Cases Documented

- WS ticket expiry mid-session → silent re-ticket
- Idempotency replay (P2P/convert) → show success without duplicate
- Partial fill market order → T-300 with partial badge
- Memo/tag required chains → block copy address until memo acknowledged
- INR withdraw bank holiday → inline message on S-523
- Sanctions 403 on P2P only → M-600, other tabs unaffected
- Account `pending_deletion` → banner on S-700

---

## Revised Surface Count

**Phase 1A claimed:** 208 (arithmetic error in summary). **Actual Phase 1A inventory:** 186. **Phase 1B total:** **194** UI surfaces (8 additions per audit §1–§5).

---

## Phase 1A Status Update

| Document | Status |
|----------|--------|
| MOB-ARCH-1A | **FROZEN** (reference baseline; amendments via 1B addendum only) |
| Consistency | **VERIFIED** |

*No backend changes. No API changes.*

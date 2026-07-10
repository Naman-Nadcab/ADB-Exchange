# MOB-012A — Screenshot Index

**Sprint:** MOB-012A — Live Device Visual Certification  
**Date:** 2026-07-10  
**Total screenshots captured:** **0**  
**Certification basis:** Live observation **not performed**

---

## 1. Summary

No screenshots were captured during MOB-012A. The audit environment lacked Android/iOS simulators, physical devices, `adb`, Maestro, and a built dev-client binary. Metro bundler started successfully but had **no connected client** to render UI.

**Screenshot index status: EMPTY — certification blocked**

---

## 2. Planned Screenshot Catalog (Not Captured)

The following catalog defines required evidence for a successful MOB-012A re-run. All entries are **PENDING**.

### App Shell

| ID | Screen | Light | Dark | Keyboard | Dialog | Status |
|----|--------|-------|------|----------|--------|--------|
| S-000 | Splash | — | — | — | — | PENDING |
| S-001 | Force Update | — | — | — | — | PENDING |
| S-002 | Maintenance | — | — | — | — | PENDING |
| S-003 | Offline Gate | — | — | — | — | PENDING |
| S-004 | Sanctions | — | — | — | — | PENDING |
| S-005 | Restricted | — | — | — | — | PENDING |
| S-007 | Rate Limited | — | — | — | — | PENDING |

### Authentication (S-100–S-115)

| ID | Screen | Light | Dark | Keyboard | Status |
|----|--------|-------|------|----------|--------|
| S-100 | Welcome | — | — | — | PENDING |
| S-101 | Login Method | — | — | — | PENDING |
| S-102–S-115 | Auth flow screens | — | — | — | PENDING (14 screens) |

### Markets (S-200–S-202)

| ID | Screen | Light | Dark | Pull-refresh | Empty | Status |
|----|--------|-------|------|--------------|-------|--------|
| S-200 | Markets Home | — | — | — | — | PENDING |
| S-201 | Market Search | — | — | — | — | PENDING |
| S-202 | Pair Detail | — | — | — | — | PENDING |

### Trading (S-300–S-304)

| ID | Screen | Light | Dark | Landscape | Status |
|----|--------|-------|------|-------------|--------|
| S-300 | Spot Trading | — | — | — | PENDING |
| S-301 | Pair Selector | — | — | — | PENDING |
| S-302 | Chart Fullscreen | — | — | — | PENDING |
| S-303 | Orderbook Fullscreen | — | — | — | PENDING |
| S-304 | Trades Fullscreen | — | — | — | PENDING |

### Wallet / Deposit / Withdraw

| ID range | Module | Screens | Status |
|----------|--------|---------|--------|
| S-500–S-551 | Portfolio / transfer / convert | 12 | PENDING |
| S-510–S-514 | Deposit | 5 | PENDING |
| S-520–S-526 | Withdraw | 5 | PENDING |
| S-719–S-720 | Address book | 2 | PENDING |

### P2P (S-600–S-616)

| ID | Screen | Modal/Sheet | Chat | Status |
|----|--------|-------------|------|--------|
| S-600 | Marketplace | Filter modal | — | PENDING |
| S-610 | Order Room | Pay/dispute | Chat panel | PENDING |
| S-600–616 | All P2P | — | — | PENDING (17 screens) |

### Account (S-700–S-792)

| ID range | Module | Screens | Status |
|----------|--------|---------|--------|
| S-700–S-792 | Account ecosystem | 35+ | PENDING |

### Global Chrome

| Element | Light | Dark | Status |
|---------|-------|------|--------|
| Bottom tab bar (5 tabs) | — | — | PENDING |
| Account modal stack | — | — | PENDING |
| Alert dialogs (copy, release, delete) | — | — | PENDING |

---

## 3. Critical Screens (Priority 1 — Must Capture on Re-Run)

| Priority | Screen ID | Why |
|----------|-----------|-----|
| P1 | S-300 | Trading terminal — chart, book, form, keyboard |
| P1 | S-200 | Primary entry — markets list performance |
| P1 | S-500 | Wallet portfolio header |
| P1 | S-512 | Deposit QR — dark mode surround |
| P1 | S-600 | P2P marketplace + filter modal |
| P1 | S-610 | P2P order room — chat + timeline |
| P1 | S-710 | Security center trust UI |
| P1 | Main tabs | Navigation chrome |

---

## 4. File Naming Convention (For Re-Run)

```
qa/mob-012a/screenshots/{platform}/{device}/{theme}/{screenId}_{state}.png

Examples:
  android/pixel7/dark/S-300_keyboard.png
  ios/iphone15pro/light/S-512_default.png
  android/tablet/dark/S-600_filter_modal.png
```

---

## 5. Maestro Flow Mapping (Available, Not Executed)

| Flow file | Intended screens | Status |
|-----------|------------------|--------|
| `e2e/auth/smoke.yaml` | S-100+ | NOT RUN |
| `e2e/markets/smoke.yaml` | S-200 | NOT RUN |
| `e2e/trade/smoke.yaml` | S-300 | NOT RUN |
| `e2e/wallet/smoke.yaml` | S-500 | NOT RUN |
| `e2e/wallet/deposit-smoke.yaml` | S-510–512 | NOT RUN |
| `e2e/wallet/withdraw-smoke.yaml` | S-520–522 | NOT RUN |
| `e2e/p2p/marketplace-smoke.yaml` | S-600 | NOT RUN |
| `e2e/account/account-smoke.yaml` | S-700 | NOT RUN |

---

## 6. Index Verdict

| Question | Answer |
|----------|--------|
| Screenshots captured? | **NO (0)** |
| Sufficient for visual certification? | **NO** |
| MOB-012B unblocked? | **NO** |

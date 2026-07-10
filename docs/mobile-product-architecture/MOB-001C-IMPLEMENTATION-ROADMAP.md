# MOB-001C — Implementation Roadmap

**Status:** FROZEN | **Start:** After MOB-001C freeze sign-off

---

## Sprint 0 — Foundation (2 weeks)

| Task | Deliverable |
|------|-------------|
| Scaffold `apps/mobile` + `packages/mobile-types` | Empty app boots |
| Core: HttpClient, SecureStore, MMKV | Integration tests pass |
| Theme tokens from MOB-001B | ThemeProvider |
| Navigation shell: Auth + Main tabs empty | Deep link config |
| EAS profiles dev/qa | CI green |
| Sentry + logger | Crash test |
| WS client skeleton | Connect auth mock |

**Exit:** App launches S-000 → S-100 placeholder tabs.

---

## Sprint 1 — Identity (2 weeks)

| Screen IDs | Module |
|------------|--------|
| S-100–115, M-100, D-110 | auth |
| D-002, D-004 | app-shell |
| W-200, S-120–123 | onboarding |

**APIs:** `/auth/*`, `/push/subscribe`  
**Exit:** E2E-001, E2E-008 pass.

---

## Sprint 2 — Markets + Trade Core (3 weeks)

| Screen IDs | Module |
|------------|--------|
| S-200–202, BS-200–201 | markets |
| S-300–304, BS-300–301, O-300, T-300 | trade |
| WS orderbook, ticker, trades | core/ws |

**Exit:** E2E-002, E2E-009; trade terminal perf budget.

---

## Sprint 3 — Orders + Wallet (3 weeks)

| Screen IDs | Module |
|------------|--------|
| S-400–404 | orders |
| S-500–532, W-510, S-512 | wallet |

**APIs:** `/spot/*` history, `/wallet/*`  
**Exit:** E2E-003, E2E-004.

---

## Sprint 4 — P2P (2 weeks)

| Screen IDs | Module |
|------------|--------|
| S-600–616, M-600–602 | p2p |

**Exit:** E2E-005; WS P2P channels.

---

## Sprint 5 — Account, Security, KYC (3 weeks)

| Screen IDs | Module |
|------------|--------|
| S-700–792, S-124 | account |
| S-710–735 | security, kyc |

**Exit:** E2E-006, E2E-007.

---

## Sprint 6 — Polish + Release (2 weeks)

| Task | |
|------|--|
| a11y audit | MOB-001B checklist |
| Golden screenshots | 10 screens |
| Perf pass | cold start <2.5s |
| Store assets | |
| QA uat sign-off | |
| Tag `mobile-v1.0.0` | |

---

## Parallel Tracks

| Track | Owner | Sprints |
|-------|-------|---------|
| Design Figma | Design | 0–2 |
| QA automation | QA | 1–6 |
| Security review | Security | 4, 6 |
| Backend liaison | Backend | 0 (push token spike only) |

---

## Jira Epic Structure

```
MOB-EPIC-SHELL
MOB-EPIC-AUTH
MOB-EPIC-MARKETS
MOB-EPIC-TRADE
MOB-EPIC-ORDERS
MOB-EPIC-WALLET
MOB-EPIC-P2P
MOB-EPIC-ACCOUNT
```

Stories = `{ScreenId} — {Screen Name}` from MOB-001B.

---

## Definition of Done (per story)

- [ ] Screen matches MOB-001B spec
- [ ] APIs via repository only
- [ ] Unit tests for ViewModel hooks
- [ ] a11y labels
- [ ] Analytics event
- [ ] No eslint/ts errors

---

## Total Timeline

**~15 weeks** to v1.0.0 store submission (team 2–3 mobile engineers).

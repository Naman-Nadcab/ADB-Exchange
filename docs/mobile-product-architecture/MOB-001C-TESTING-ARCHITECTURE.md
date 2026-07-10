# MOB-001C — Testing Architecture

**Status:** FROZEN

---

## 1. Test Pyramid

```
        ┌─────────┐
        │ Maestro │  E2E (smoke + critical paths)
        ├─────────┤
        │ RNTL    │  Component + hooks
        ├─────────┤
        │ Jest    │  Unit + integration
        └─────────┘
```

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| Unit | Jest | core/domain 90%, repositories 80% |
| Integration | Jest + MSW | API + WS handlers 75% |
| Component | RNTL | shared/ui 70% |
| E2E | Maestro | 12 flows (auth, trade, deposit, withdraw, p2p) |
| Golden | jest-image-snapshot | 10 key screens |
| Performance | Reassure / custom | Trade terminal budget |
| a11y | jest-axe RN | Auth, trade, wallet |

---

## 2. Unit Testing

- `core/domain/**` — pure functions 100% critical paths
- `core/api/errors/**` — error mapping table tests
- `core/ws/reconnectPolicy.ts` — timing logic fake timers

---

## 3. Integration Testing

- MSW handlers from `tests/__fixtures__/api/`
- Repository tests hit MSW not real backend
- WS mock server replay captured frames

---

## 4. Component Testing

- `shared/ui` each variant state: default, loading, disabled, error
- Snapshot only for stable primitives — prefer explicit assertions

---

## 5. E2E Flows (Maestro)

| ID | Flow |
|----|------|
| E2E-001 | Login OTP → markets |
| E2E-002 | Place limit order mock |
| E2E-003 | Deposit view address |
| E2E-004 | Withdraw flow guard |
| E2E-005 | P2P browse ads |
| E2E-006 | KYC hub navigate |
| E2E-007 | 2FA setup skip |
| E2E-008 | Logout |
| E2E-009 | Deep link trade pair |
| E2E-010 | Offline banner |
| E2E-011 | Push cold start route |
| E2E-012 | App lock resume |

Run against QA API + test accounts (`qa:e2e-credentials` monorepo script).

---

## 6. Regression Suite

- Full E2E nightly
- Unit+integration every PR
- Golden screenshots on design token change only

---

## 7. Release Tests

Pre-store checklist:

- [ ] Smoke E2E pass qa
- [ ] Manual spot order qa env
- [ ] Withdraw testnet/sandbox
- [ ] P2P sandbox order
- [ ] Certificate pinning verify prod build
- [ ] App Store screenshot devices

---

## 8. QA Ownership

| Module | Test lead assignment |
|--------|---------------------|
| auth | E2E-001,008 |
| trade | E2E-002,009 + perf |
| wallet | E2E-003,004 |
| p2p | E2E-005 |
| account | E2E-006,007 |

Screen ID = test case ID prefix.

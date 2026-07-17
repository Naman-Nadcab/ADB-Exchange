# Deferred Features — METHErium Mobile

Features explicitly **out of scope** for v1.0.0 engineering freeze. Phase 8 addresses UI polish only, not new capabilities.

---

## Product (not implemented)

| Feature | Status | Reference |
|---------|--------|-----------|
| Fiat deposit rails (full) | Partial — withdraw path exists; deposit marketing "Coming Soon" | Website parity backlog |
| Passkey login (production) | UI scaffold; backend integration deferred | Auth screens |
| Push notifications (production FCM/APNs) | Repository exists; device registration E2E deferred | `PushRepository` |
| Physical device biometrics E2E | Simulator-limited | Manual device test |
| Android release certification | SDK not in audit environment | Phase 7.5 |

---

## QA / Certification (deferred execution)

| Item | Blocker |
|------|---------|
| Full 95+ screen visual certification | Requires authenticated cert + all devices |
| 30s screen recordings per critical flow | MOB-012A protocol |
| Dynamic font accessibility matrix | Manual Settings pass |
| Permission automation (camera, push, gallery) | Scripting + physical device |

---

## Engineering (intentionally frozen — not deferred bugs)

No open engineering defects block Phase 8. Phase 7.1 verified fixes are merged:

- WS duplicate dispatch — fixed
- Offline WS reconnect bypass — fixed
- Withdrawal detail pagination — fixed

---

## Phase 8 scope reminder

Phase 8 may change: typography, spacing, colors, motion, empty states, loading skeletons, iconography.

Phase 8 may **not** change: API contracts, repository methods, navigation graph, business rules, state shape.

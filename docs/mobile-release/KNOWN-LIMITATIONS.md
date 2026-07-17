# Known Accepted Limitations — METHErium Mobile v1.0.0

Items documented here are **accepted for v1.0.0** and do not block Phase 8 UI polish unless product re-prioritizes.

---

## Platform & QA

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Android emulator not configured in dev environment | Android device matrix not automated | Install SDK; run Maestro on emulator when available |
| `simctl rotate` unavailable | Landscape not scriptable on current Xcode | Manual rotation in Simulator |
| iOS 26.5 simulators slower for guest bootstrap | Maestro timeout on SE/15 (26.5) | Use iOS 26.4 sims for automation |
| Dev-client rapid `clearState` | Fabric teardown crash in back-to-back Maestro | 5s pause between flows (`FLOW_PAUSE_SEC`) |
| Authenticated E2E requires backend or cert preview | Wallet/P2P authenticated flows not in default smoke | `EXPO_PUBLIC_CERT_PREVIEW=1` or staging credentials |

---

## Product / UI (website parity deferred to Phase 8)

| Limitation | Notes |
|------------|-------|
| Welcome screen shows "Fiat: Coming Soon" | Fiat withdraw flows exist; marketing copy may lag website |
| ESLint 11 warnings | Non-blocking hook-deps warnings; no errors |
| Full device matrix not executed on all form factors | Partial iOS coverage in Phase 7.5 |

---

## Dev-only tooling

| Item | Notes |
|------|-------|
| `certPreview` / `authPreview` flags | Dev-only; seeded mock data for screenshots |
| Phase 0–3 screenshot scripts | Legacy; superseded by Maestro + `scripts/qa/` |

---

## Infrastructure

| Item | Notes |
|------|-------|
| EAS project ID placeholder | Set `EAS_PROJECT_ID` before store submission |
| Default API points to localhost in development | Override via `EXPO_PUBLIC_API_URL` / `APP_ENV` |

---

## Not limitations (verified working)

- Release cold launch on iOS ✅
- Deep-link routing (trade, wallet, p2p, account, login) ✅
- Guest deposit/withdraw guards ✅
- Single WebSocket owner (Phase 7.1 fix) ✅
- Withdrawal detail pagination fallback ✅

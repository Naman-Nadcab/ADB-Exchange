# METHErium Mobile — Maestro E2E

## Bootstrap flows (`_bootstrap/`)

| Flow | Use when | Requires |
|------|----------|----------|
| `devClient.yaml` | Debug/dev-client build | Metro `npx expo start --dev-client --port 8081` |
| `guestMain.yaml` | Guest session via dev-client | Metro + dev-client |
| `certMain.yaml` | Authenticated cert preview | Metro + `EXPO_PUBLIC_CERT_PREVIEW=1` |
| `releaseBootstrap.yaml` | Production Release sim build | Release `.app` installed, no Metro |
| `releaseGuestMain.yaml` | Guest on Release build | Release `.app` installed |
| `acceptDeepLinkPrompt.yaml` | After `openLink` on iOS | Dismisses "Open in METHErium?" system dialog |

## Tab navigation

Use accessibility labels (not coordinates):

- `tapTabMarkets.yaml` → `"Markets"`
- `tapTabTrade.yaml` → `"Trade"`
- `tapTabOrders.yaml` → `"Orders"`
- `tapTabWallet.yaml` → `"Wallet"`
- `tapTabP2P.yaml` → `"P2P"`

Requires `accessibilityLabel` on tab bar (`BottomNavigation.tsx`).

## Smoke suites (`*/smoke.yaml`)

Dev-client smokes use `guestMain.yaml`. Run via:

```bash
npm run qa:smoke:dev -w apps/mobile
```

Release deep-link matrix:

```bash
npm run qa:matrix:ios -w apps/mobile
```

## Stability notes

1. **Dev-client:** Avoid running all smokes back-to-back without pause — rapid `clearState` can trigger React Native Fabric teardown crashes. Scripts insert a 5s delay between flows.
2. **Release:** Preferred for device-matrix validation; no Metro dependency.
3. **iOS deep links:** Always follow `openLink` with `acceptDeepLinkPrompt.yaml` on iOS simulators.
4. **Small screens (SE):** `guestMain` / `releaseGuestMain` scroll to "Continue as Guest" when needed.

## Selectors

| Screen | testID / label |
|--------|----------------|
| Welcome | `S-100` |
| Login password | `S-103` |
| Markets home | `S-200` |
| Market search | `S-201` |
| Spot trading | `S-300` |
| Wallet home | `S-500` |
| P2P marketplace | `S-600` |
| Account home | `S-700` |
| Account entry (header) | accessibility `"Account"` |

## Android

Maestro flows use `appId: com.metheorium.mobile`. Android readiness requires SDK + emulator — see `scripts/qa/check-environment.sh`.

# MOB-001C — Dependency Audit

**Status:** FROZEN

---

## Core Dependencies (required)

| Package | Version policy | Class | Purpose |
|---------|----------------|-------|---------|
| expo | ~52 | Core | Toolchain |
| react-native | 0.76+ | Core | Runtime |
| react | 18.3+ | Core | UI |
| @react-navigation/native | ^7 | Core | Navigation |
| @react-navigation/native-stack | ^7 | Core | Stacks |
| @react-navigation/bottom-tabs | ^7 | Core | Tabs |
| @tanstack/react-query | ^5 | Core | Server state |
| zustand | ^5 | Core | Client state |
| react-hook-form | ^7 | Core | Forms |
| zod | ^3 | Core | Validation |
| expo-secure-store | * | Native | Tokens |
| react-native-mmkv | ^2 | Native | Fast KV |
| expo-local-authentication | * | Native | Biometrics |
| @sentry/react-native | ^5 | Third party | Crashes |
| date-fns | ^3 | Third party | Dates |
| decimal.js | ^10 | Third party | Money math |
| @shopify/flash-list | ^1 | Third party | Lists |

## WebSocket & Network

| Package | Class | Purpose |
|---------|-------|---------|
| @react-native-community/netinfo | Core | Offline |
| isomorphic-ws (if needed) | Optional | WS polyfill tests |

## Charts (pick one — ADR-010)

| Package | Class | Status |
|---------|-------|--------|
| @shopify/react-native-skia | Native | Preferred |
| react-native-wagmi-charts | Third party | Fallback |

## Security (production)

| Package | Class | Purpose |
|---------|-------|---------|
| react-native-ssl-pinning | Native | Pinning |
| react-native-passkeys | Native | Passkeys |

## UI / UX

| Package | Class | Purpose |
|---------|-------|---------|
| react-native-reanimated | Core | Motion MOB-001B |
| react-native-gesture-handler | Core | Gestures |
| react-native-safe-area-context | Core | Safe area |
| expo-image | Core | Images |
| expo-clipboard | Core | Copy policy |
| expo-haptics | Core | Haptics |
| expo-notifications | Native | Push |
| expo-file-system | Native | Uploads |

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| typescript | ~5.4 |
| jest | unit |
| @testing-library/react-native | component |
| msw | API mock |
| maestro-cli | E2E |
| eslint | lint |
| @typescript-eslint/* | lint |

## Optional (v1.1+)

| Package | Class | Future |
|---------|-------|--------|
| i18next | Optional | Hindi |
| react-native-widget-extension | Future | iOS widget |
| op-sqlite | Future | Offline queue |

## Explicitly Excluded

| Package | Reason |
|---------|--------|
| redux / mobx | ADR-004/005 |
| axios | fetch sufficient + interceptors |
| socket.io-client | Wrong protocol |
| moment | bundle size |
| async-storage | MMKV replaces |
| expo-router | React Navigation chosen ADR-003 |

## Risk Classification

| Risk | Mitigation |
|------|------------|
| Native module breakage on RN upgrade | Pin versions; EAS build matrix |
| Skia binary size | Monitor bundle budget |
| SSL pinning rotation | Dual pin + doc runbook |

## License Policy

Production deps: MIT, Apache-2.0, BSD-3 only. GPL rejected.

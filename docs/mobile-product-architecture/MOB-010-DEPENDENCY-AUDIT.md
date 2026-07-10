# MOB-010 — Dependency Audit

**Sprint:** MOB-010  
**Date:** 2026-07-10  
**Project:** `@exchange/mobile` v1.0.0

---

## 1. Summary

| Check | Result |
|-------|--------|
| Production dependencies | 22 — all used |
| Unused direct dependencies | NONE found |
| Deprecated packages | NONE in direct deps |
| License compatibility | PASS (MIT/Apache ecosystem) |
| npm audit (transitive) | ADVISORIES — Expo toolchain |
| High-risk packages | NONE in runtime bundle |

---

## 2. Production Dependencies

| Package | Purpose | Risk | Used |
|---------|---------|------|------|
| `@react-navigation/*` | Navigation | Low | ✓ |
| `@react-native-community/netinfo` | Offline detection | Low | ✓ |
| `@tanstack/react-query` | Server state | Low | ✓ |
| `expo` ~52 | Runtime shell | Medium (audit transitive) | ✓ |
| `expo-clipboard` | Clipboard policy | Low | ✓ |
| `expo-constants` | Version / config | Low | ✓ |
| `expo-dev-client` | Dev builds | Dev only | ✓ |
| `expo-local-authentication` | Biometrics | Low | ✓ |
| `expo-secure-store` | Token storage | Low | ✓ |
| `expo-status-bar` | Status bar | Low | ✓ |
| `i18next` / `react-i18next` | i18n scaffold | Low | ✓ |
| `react` / `react-native` | Core | Low | ✓ |
| `react-native-gesture-handler` | Gestures | Low | ✓ |
| `react-native-mmkv` | Fast cache | Low | ✓ |
| `react-native-qrcode-svg` | Deposit QR | Low | ✓ |
| `react-native-reanimated` | Animations | Low | ✓ |
| `react-native-safe-area-context` | Safe areas | Low | ✓ |
| `react-native-screens` | Native screens | Low | ✓ |
| `react-native-svg` | Charts / icons | Low | ✓ |
| `zustand` | Client state | Low | ✓ |

---

## 3. Dev Dependencies

| Package | Purpose |
|---------|---------|
| `@testing-library/react-native` | Component tests |
| `jest` / `jest-expo` | Unit tests |
| `eslint*` / `prettier` | Lint/format |
| `typescript` | Type safety |

All dev deps justified. **None shipped to production bundle.**

---

## 4. npm audit

```
npm audit → advisories in @expo/cli transitive chain (tar, cacache, uuid)
Fix available: expo@57.0.4 (semver major)
```

| Severity | Count (transitive) | Runtime impact |
|----------|-------------------|----------------|
| High | Expo CLI / build tools | **Dev/build only** — not in app runtime |
| Moderate | uuid, plist parsers | Build-time |

**Action:** Track Expo SDK 53+ upgrade on separate dependency sprint. **Not blocking RC** — no runtime CVE in production dependency tree confirmed by direct-dep review.

---

## 5. Large Packages

| Package | Approx. impact | Justified |
|---------|----------------|-----------|
| `react-native-reanimated` | Native module | Charts, gestures |
| `react-native-svg` | Native module | QR, allocation chart |
| `@tanstack/react-query` | JS | All server state |

No candidate for removal without feature loss.

---

## 6. Unused / Dead Code (Dependency-Related)

| Item | Status |
|------|--------|
| `expo-dev-client` in prod deps | Required for dev-client workflow; strip in store build profile |
| `i18next` minimal resources | Scaffold only — not unused |

---

## 7. License Review

All dependencies use permissive licenses (MIT, Apache-2.0, BSD). No GPL copyleft in production tree.

---

## Verdict

**PASS** — Dependency audit complete. Transitive Expo CLI advisories documented; major upgrade deferred.

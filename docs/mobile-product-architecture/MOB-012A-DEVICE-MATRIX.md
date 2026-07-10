# MOB-012A — Device Matrix

**Sprint:** MOB-012A — Live Device Tier-1 Visual Certification  
**Date:** 2026-07-10  
**Audit environment:** Linux CI host (`/opt/m-live`)  
**Application:** METHErium Mobile RC v1.0.0 (`expo-dev-client`)

---

## 1. Environment Capability Audit

| Requirement | Required for MOB-012A | Observed | Result |
|-------------|----------------------|----------|--------|
| Android SDK / `adb` | Yes | **Not installed** (`adb: command not found`) | ❌ BLOCKED |
| Android Emulator | Yes | **Not installed** (no AVD, no KVM device) | ❌ BLOCKED |
| Java JDK | Yes (Android build) | **Not installed** | ❌ BLOCKED |
| iOS Simulator (`xcrun`) | Yes | **Not available** (Linux host) | ❌ BLOCKED |
| Physical Android device | Yes | **None connected** | ❌ BLOCKED |
| Physical iPhone | Yes | **None connected** | ❌ BLOCKED |
| Maestro CLI | Recommended (e2e capture) | **Not installed** | ❌ BLOCKED |
| Native project (`android/`/`ios/`) | Required for local run | **Not generated** (Expo managed; needs `expo prebuild` or EAS build) | ❌ BLOCKED |
| Dev client binary | Required (`expo start --dev-client`) | **Not present** in workspace | ❌ BLOCKED |
| Metro bundler | Required | ✅ Started on `:8081` | ⚠️ PARTIAL (no client) |
| Screenshot artifacts | Required | **0 files** captured | ❌ BLOCKED |
| Video artifacts | Required | **0 files** captured | ❌ BLOCKED |

**Conclusion:** Live device matrix **cannot be executed** in the current audit environment.

---

## 2. Android Device Matrix

| Device class | OS target | Light mode | Dark mode | Landscape | Status | Evidence |
|--------------|-----------|------------|-----------|-----------|--------|----------|
| Small phone (5.0–5.4") | Android 13 | — | — | — | **NOT RUN** | No emulator |
| Small phone | Android 14 | — | — | — | **NOT RUN** | No emulator |
| Small phone | Android 15 | — | — | — | **NOT RUN** | No emulator |
| Medium phone (5.5–6.2") | Android 13 | — | — | — | **NOT RUN** | No emulator |
| Medium phone | Android 14 | — | — | — | **NOT RUN** | No emulator |
| Medium phone | Android 15 | — | — | — | **NOT RUN** | No emulator |
| Large phone (6.3–6.8") | Android 13 | — | — | — | **NOT RUN** | No emulator |
| Large phone | Android 14 | — | — | — | **NOT RUN** | No emulator |
| Large phone | Android 15 | — | — | — | **NOT RUN** | No emulator |
| Tablet (7"+) | Android 13+ | — | — | — | **NOT RUN** | No emulator |

---

## 3. iPhone Device Matrix

| Device class | OS target | Light mode | Dark mode | Landscape | Status | Evidence |
|--------------|-----------|------------|-----------|-----------|--------|----------|
| iPhone SE | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |
| iPhone Standard (6.1") | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |
| iPhone Plus (6.5–6.7") | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |
| iPhone Pro | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |
| Dynamic Island (15 Pro+) | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |
| Safe Area notch devices | iOS latest sim | — | — | — | **NOT RUN** | No macOS / Simulator |

---

## 4. Planned Capture Protocol (Not Executed)

When devices become available, each cell must capture:

1. Cold launch → auth or main (as applicable)
2. All module tabs in light + dark
3. Every dialog, modal, keyboard state
4. Loading / empty / error / offline / success states
5. 30s screen recording per critical flow (trade, withdraw, P2P order room)

**Screen inventory target:** 95+ `testID` screens (S-000–S-792)

---

## 5. Alternative Run Paths Evaluated

| Path | Result |
|------|--------|
| `npx expo start` (Metro) | ✅ Bundler starts; **no client connected** |
| `expo start --web` | ❌ Not supported (`react-native-web` not in dependencies) |
| Local `expo run:android` | ❌ No SDK, no `android/` folder |
| Local `expo run:ios` | ❌ Linux host — no Xcode |
| EAS cloud build + device farm | ❌ Not executed (no EAS credentials / device farm in environment) |
| Maestro e2e flows (7 yaml) | ❌ Maestro CLI not installed; no device |

---

## 6. Re-Run Prerequisites for MOB-012A

Before MOB-012A can be re-attempted:

1. Install Android SDK + emulator **or** connect physical devices via `adb`
2. **Or** use macOS host with Xcode + iOS Simulator
3. Build dev client: `eas build --profile development` **or** `npx expo prebuild && npx expo run:android/ios`
4. Install Maestro for automated navigation + screenshot capture
5. Provide QA credentials for authenticated flows
6. Store artifacts under `apps/mobile/qa/mob-012a/{screenshots,videos}/`

---

## 7. Device Matrix Verdict

| Metric | Value |
|--------|-------|
| Matrix cells planned | 22 |
| Matrix cells executed | **0** |
| Screenshots captured | **0** |
| Videos captured | **0** |
| Live observation possible | **NO** |

**Device matrix certification: FAILED (not executed)**

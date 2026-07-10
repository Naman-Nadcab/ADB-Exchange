# MOB-012A — Live Device Certification

**Certificate ID:** MOB-012A-LIVE-VISUAL-CERT  
**Date:** 2026-07-10  
**Sprint:** MOB-012A — Live Device Tier-1 Visual Certification  
**Application:** METHErium Mobile RC v1.0.0  
**Method:** Live device / simulator observation **ONLY**  
**Code changes:** **NONE**

---

## Certification Statement

MOB-012A attempted to certify the **actual running** METHErium Mobile application on the required Android and iOS device matrix. The mission **did not complete** because no simulators, emulators, or physical devices were available in the audit environment, and no dev-client binary was built or connected to Metro.

**This sprint does NOT certify Tier-1 visual quality.**

Prior static audit MOB-011 is **not** a substitute for MOB-012A and is **not** incorporated into this certification.

---

## 1. Mission Execution Log

| Step | Timestamp | Result | Evidence |
|------|-----------|--------|----------|
| Environment probe | 2026-07-10 | `adb` not found | Shell audit |
| iOS Simulator probe | 2026-07-10 | `xcrun` unavailable (Linux) | Shell audit |
| Java / Android SDK probe | 2026-07-10 | Not installed | Shell audit |
| Maestro CLI probe | 2026-07-10 | Not installed | Shell audit |
| Native project probe | 2026-07-10 | No `android/` or `ios/` dirs | Filesystem |
| Dev client binary probe | 2026-07-10 | Not present | Filesystem |
| Metro bundler launch | 2026-07-10 | ✅ Port 8081 | `npx expo start` |
| Client connection | 2026-07-10 | ❌ None | No device |
| Screenshot capture | 2026-07-10 | ❌ 0 files | Empty index |
| Video capture | 2026-07-10 | ❌ 0 files | Empty index |
| VoiceOver / TalkBack | 2026-07-10 | ❌ Not run | No device |
| Module navigation (live) | 2026-07-10 | ❌ Not run | No device |

---

## 2. Scope vs Completion

| Certification area | Required | Completed |
|--------------------|----------|-----------|
| Android small/medium/large/tablet | Yes | **0%** |
| Android 13/14/15 | Yes | **0%** |
| iPhone SE/Standard/Plus/Pro/DI | Yes | **0%** |
| All modules navigated live | Yes | **0%** |
| Every screen captured | Yes | **0%** |
| Every dialog/sheet/keyboard state | Yes | **0%** |
| Light + dark every screen | Yes | **0%** |
| Landscape (where supported) | Yes | **0%** |
| Visible performance observation | Yes | **0%** |
| Accessibility (VO/TalkBack) | Yes | **0%** |

---

## 3. Infrastructure Blockers (Objective)

1. **No Android Platform Tools** — `adb` not installed; no physical device detected  
2. **No Android Emulator** — no AVD, no emulator packages, no KVM device  
3. **No iOS Simulator** — audit host is Linux; Xcode unavailable  
4. **No dev-client APK/IPA** — app uses `expo-dev-client`; requires EAS build or local prebuild  
5. **No Maestro** — 7 e2e flows exist but automation tooling not installed  
6. **No web fallback** — `react-native-web` not configured; cannot render native UI in browser  

---

## 4. What Metro Start Proves (and Does Not Prove)

| Proves | Does NOT prove |
|--------|----------------|
| JavaScript bundle compiles | Visual hierarchy on device |
| Metro dev server healthy | Spacing/typography rendering |
| Project starts without crash at tooling level | Touch targets at runtime |
| | Dark mode appearance |
| | Animation smoothness |
| | Safe area insets on notch/DI devices |

---

## 5. Deliverables Produced

| Document | Status |
|----------|--------|
| [MOB-012A-DEVICE-MATRIX.md](MOB-012A-DEVICE-MATRIX.md) | Complete — all cells NOT RUN |
| [MOB-012A-SCREENSHOT-INDEX.md](MOB-012A-SCREENSHOT-INDEX.md) | Complete — 0 captures |
| [MOB-012A-VIDEO-INDEX.md](MOB-012A-VIDEO-INDEX.md) | Complete — 0 captures |
| [MOB-012A-FINAL-SCORE.md](MOB-012A-FINAL-SCORE.md) | Complete — scores WITHHELD |
| [MOB-012A-POLISH-INPUT.md](MOB-012A-POLISH-INPUT.md) | Complete — re-run protocol only |
| MOB-012A-LIVE-DEVICE-CERTIFICATION.md | This document |

---

## 6. FINAL VERDICT

# Tier-1 Visual NOT Certified

| Criterion | Met? |
|-----------|------|
| Live UI observed on real device or simulator | **NO** |
| Screenshot evidence captured | **NO** |
| Video evidence captured | **NO** |
| Per-screen live scores assigned | **NO** |
| Objective evidence for certification | **NO** |
| Code/implementation modified | **NO** |

---

## 7. Re-Certification Requirements

MOB-012A must be **re-run** on a QA host with:

- macOS (iOS Simulator) **and/or** Android SDK + emulator **and/or** physical devices  
- Built dev client (`eas build --profile development`)  
- Maestro installed for flow automation  
- QA test account with funded sandbox data  
- Artifact storage at `apps/mobile/qa/mob-012a/`  

Until re-run completes with populated screenshot/video indexes, **MOB-012B polish sprint must not begin.**

---

## 8. Compliance with MOB-012A Rules

| Rule | Compliant? |
|------|------------|
| No production code written | ✅ YES |
| No redesign / refactor | ✅ YES |
| Inspection only | ✅ YES (inspection attempted; blocked by infra) |
| Scores from observable behaviour only | ✅ YES (no false scores issued) |
| No middle-ground verdict | ✅ YES (NOT Certified only) |

---

**MOB-012A LIVE DEVICE CERTIFICATION: NOT GRANTED**

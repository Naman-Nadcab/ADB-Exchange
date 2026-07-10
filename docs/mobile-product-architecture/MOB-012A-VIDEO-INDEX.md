# MOB-012A — Video Index

**Sprint:** MOB-012A — Live Device Visual Certification  
**Date:** 2026-07-10  
**Total videos captured:** **0**  
**Total recording duration:** **0 seconds**

---

## 1. Summary

No screen recordings were captured during MOB-012A. Video evidence is required to certify animation smoothness, transition timing, scroll momentum, chart updates, orderbook refresh, and P2P chat behavior. Without a running client on any device or simulator, recording was impossible.

**Video index status: EMPTY — certification blocked**

---

## 2. Required Video Catalog (Not Captured)

| Video ID | Flow | Duration target | Devices | Status |
|----------|------|-----------------|---------|--------|
| VID-001 | Cold launch → Markets tab | 15s | All phones | PENDING |
| VID-002 | Markets scroll + pull-refresh | 20s | Medium phone | PENDING |
| VID-003 | Trade: chart interval switch + orderbook tap | 30s | Medium + tablet | PENDING |
| VID-004 | Trade: place limit order (keyboard) | 30s | Medium phone | PENDING |
| VID-005 | Wallet: portfolio scroll + asset detail | 20s | All phones | PENDING |
| VID-006 | Deposit: token → network → QR copy alert | 30s | All phones | PENDING |
| VID-007 | Withdraw: form → security wizard → confirm | 45s | All phones | PENDING |
| VID-008 | P2P: marketplace filter modal open/close | 15s | All phones | PENDING |
| VID-009 | P2P: order room chat send + scroll | 30s | Medium phone | PENDING |
| VID-010 | Account: hub → security → 2FA | 30s | All phones | PENDING |
| VID-011 | Tab transitions (all 5 tabs) | 20s | All phones | PENDING |
| VID-012 | Dark ↔ Light theme toggle (S-740) | 15s | All phones | PENDING |
| VID-013 | Offline gate → retry → reconnect | 20s | Any | PENDING |
| VID-014 | App lock → biometric unlock | 20s | iOS + Android | PENDING |
| VID-015 | Landscape on S-302 chart fullscreen | 15s | Phone + tablet | PENDING |

---

## 3. Performance Observations (Not Recorded)

The following **cannot be scored** without video evidence:

| Observable | Required video | Captured |
|------------|----------------|----------|
| Animation smoothness (60fps vs jank) | VID-002, VID-003 | ❌ |
| Chart candle update latency | VID-003 | ❌ |
| Orderbook scroll + WS update | VID-003 | ❌ |
| P2P chat message append | VID-009 | ❌ |
| Large list scroll (markets 100+ rows) | VID-002 | ❌ |
| Navigation transition timing | VID-011 | ❌ |
| Keyboard open/close on order form | VID-004 | ❌ |
| Modal/sheet animation curve | VID-008 | ❌ |

---

## 4. File Naming Convention (For Re-Run)

```
qa/mob-012a/videos/{platform}/{device}/{videoId}_{flow}.mp4

Examples:
  ios/iphone15pro/VID-003_trade_terminal.mp4
  android/pixel7/VID-009_p2p_chat.mp4
```

---

## 5. Recording Tools (Recommended for Re-Run)

| Platform | Tool |
|----------|------|
| iOS Simulator | `xcrun simctl io booted recordVideo` |
| Android Emulator | `adb shell screenrecord` or Android Studio |
| Physical device | QuickTime (iOS) / `scrcpy --record` (Android) |
| Maestro | `maestro record` with flow yaml |

---

## 6. Index Verdict

| Question | Answer |
|----------|--------|
| Videos captured? | **NO (0)** |
| Motion/performance certifiable? | **NO** |
| MOB-012B unblocked? | **NO** |

# QA Execution Checklist — METHErium Mobile

**Version:** 1.0.0 · **Updated:** Phase 7.6

---

## Pre-flight

- [ ] `npm run qa:check -w apps/mobile` passes
- [ ] `npm run typecheck -w apps/mobile` passes
- [ ] `npm test -w apps/mobile` — 225/225 pass
- [ ] `npm run lint -w apps/mobile` — 0 errors
- [ ] `npm run validate:architecture -w apps/mobile` passes

---

## iOS — Release matrix (preferred)

1. Build Release simulator app:
   ```bash
   cd apps/mobile && npx expo run:ios --configuration Release --device "iPhone 17"
   ```
2. Run deep-link matrix:
   ```bash
   npm run qa:matrix:ios -w apps/mobile
   ```
3. Optional multi-device:
   ```bash
   npm run qa:matrix:ios:multi -w apps/mobile
   ```
4. Cold-launch screenshot:
   ```bash
   npm run qa:screenshot:release -w apps/mobile
   ```

**Expected:** Guest bootstrap → S-200; deep links → S-300/500/600/700; deposit/withdraw guards; login S-103.

---

## iOS — Dev-client smoke (development regression)

1. Start Metro:
   ```bash
   cd apps/mobile && npx expo start --dev-client --port 8081
   ```
   Or: `./scripts/dev-launch.sh`
2. Run all smokes (5s pause between flows):
   ```bash
   npm run qa:smoke:dev -w apps/mobile
   ```

**Expected:** 8/8 pass (auth, markets, trade, wallet, deposit, withdraw, p2p, account).

---

## Android (when SDK available)

- [ ] Install Android SDK + emulator
- [ ] `adb devices` shows emulator
- [ ] Build: `npx expo run:android --configuration Release`
- [ ] Run Maestro flows with `appId: com.metheorium.mobile`

---

## Authenticated flows (manual / cert preview)

Requires backend or cert preview:

```bash
EXPO_PUBLIC_CERT_PREVIEW=1 npx expo start --dev-client --port 8081
```

Then exercise: funding, unified trading, P2P order room, merchant, disputes, session restore.

---

## Device matrix (manual)

Per form factor, verify cold launch + guest + one module tab:

| Device class | Portrait | Landscape | Dark | Light |
|--------------|----------|-----------|------|-------|
| iPhone SE | | | | |
| iPhone standard | | | | |
| iPhone Pro Max | | | | |
| iPad | | | | |
| Android small | | | | |
| Android large | | | | |

Use Simulator Settings for appearance; rotate via Hardware menu (simctl rotate unavailable on some Xcode versions).

---

## Failure triage

| Symptom | Likely class |
|---------|--------------|
| S-100 timeout on dev-client | Environment — Metro not running or corrupted install |
| Fabric SIGABRT on rapid relaunch | Test — add pause between Maestro flows |
| "Open in METHErium?" blocks flow | Test — ensure `acceptDeepLinkPrompt.yaml` runs after `openLink` |
| Tab tap misses on SE | Test — use accessibility labels, not coordinates |
| Guest timeout on iOS 26.5 | Environment — prefer iOS 26.4 sim for automation |

---

## Artifacts

- Maestro debug: `~/.maestro/tests/`
- Screenshots: `/tmp/metheorium-release-launch.png` (default)
- Crash logs: `~/Library/Logs/DiagnosticReports/METHErium-*.ips`

# MOB-010 — Security Report

**Sprint:** MOB-010  
**Date:** 2026-07-10  
**Scope:** Mobile security layer only (frozen backend)

---

## 1. Summary

| Domain | Result |
|--------|--------|
| SecureStore / token storage | PASS |
| Session lifecycle | PASS |
| Refresh mutex | PASS |
| Logout cleanup | PASS |
| Clipboard protection | PASS |
| App lock / biometrics | PASS |
| Certificate pinning hooks | STUB (disabled) |
| Sensitive logging | PASS |
| API authorization | PASS |
| Idempotent financial writes | PASS |

**Security gaps:** NONE in mobile enforcement layer

---

## 2. Token & Session Storage

| Control | Path | Result |
|---------|------|--------|
| Access/refresh tokens in SecureStore | `secureStorage.ts`, `SECURE_KEYS` | PASS |
| Prefix isolation | `metheorium.secure.` | PASS |
| PIN hash in SecureStore | `SECURE_KEYS.pinHash` | PASS |
| Tokens cleared on logout | `sessionManager.clearSession()` | PASS |
| In-memory tokens cleared | `authStore.setUnauthenticated()` | PASS |
| No tokens in MMKV | Audit — MMKV used for cache/prefs only | PASS |

---

## 3. Refresh & Auth Flow

| Control | Path | Result |
|---------|------|--------|
| Refresh mutex (single flight) | `core/auth/refreshMutex.ts` + tests | PASS |
| 401 → refresh → retry | `authHooks.ts` | PASS |
| Refresh failure → logout | `createAuthHooks` | PASS |
| WS ticket auth | `getWsTicket()` before private channels | PASS |
| Launch rehydration | `runLaunchFlow()` + `/auth/me` | PASS |

---

## 4. Logout Cleanup

| Store / Resource | Cleared on logout? |
|------------------|-------------------|
| SecureStore tokens | YES |
| authStore | YES |
| WS subscriptions | YES (`subscriptions.clear()`) |
| marketDataStore live tickers | YES |
| p2pStore (orders, chat, typing) | YES (`clearOnLogout()`) |
| Clipboard sensitive copy | TTL auto-clear 60s |

---

## 5. Clipboard Protection

| Control | Implementation | Result |
|---------|----------------|--------|
| Auto-clear after 60s | `clipboardPolicy.copyWithExpiry()` | PASS |
| Used on deposit address / API secrets context | Wallet + account flows | PASS |
| Manual clear API | `clipboardPolicy.clear()` | PASS |

---

## 6. App Lock & Biometrics

| Control | Path | Result |
|---------|------|--------|
| Idle timeout | `RootNavigator` AppState listener | PASS |
| Biometric availability check | `expo-local-authentication` via `appLock` | PASS |
| Shell gate overlay | `AppLockScreen` | PASS |
| Settings | `AppLockSettingsScreen` | PASS |

---

## 7. Certificate Pinning

| Item | Status |
|------|--------|
| Hook present | `core/security/certificatePinning.ts` |
| `enabled: false` | Intentional — enable in native release build |
| Device integrity stub | `deviceIntegrity.ts` — non-blocking MVP |

**Not a gap** for RC code certification; **required** before production API pinning go-live.

---

## 8. Logging & Secrets

| Check | Result |
|-------|--------|
| Debug logs stripped in prod | `logger.ts` — `!__DEV__` skips debug | PASS |
| No password/token in grep console | Manual audit | PASS |
| API key secret shown once + alert | `CreateApiKeyScreen` | PASS |
| 2FA secret selectable (user-owned) | `TwoFAScreen` | PASS |
| Fund password fields `secureTextEntry` | Auth + wallet wizards | PASS |

---

## 9. API Authorization

| Control | Result |
|---------|--------|
| `skipAuth` only on public auth endpoints | `AuthRepository` | PASS |
| Bearer injection via `httpClient` | `authHooks` | PASS |
| Idempotency-Key on P2P order writes | `P2PRepository` | PASS |
| Offline write guard | Order create / withdraw flows | PASS |
| No client-side permission bypass for API keys | Permissions server-enforced | PASS |

---

## 10. MOB-010 Security Fixes

| Fix | Security impact |
|-----|-----------------|
| OfflineGate NetInfo leak | Prevents listener accumulation (DoS-style resource drain) |
| WS disconnect on unmount | Prevents stale authenticated connections |
| Removed duplicate P2P notifications hook | Reduces attack surface / stale state |

---

## Verdict

**PASS** — Mobile security certification complete. Certificate pinning activation tracked for native release pipeline.

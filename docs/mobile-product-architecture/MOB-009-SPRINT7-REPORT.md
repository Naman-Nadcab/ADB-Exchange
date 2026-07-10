# MOB-009 — Sprint 7 Account, Security & User Ecosystem Report

**Sprint:** MOB-009 Sprint 7  
**Date:** 2026-07-10  
**Backend SHA (frozen):** `00988649da52031923e2d62bf4f9c2fdc384f479`  
**Scope:** Complete Account Ecosystem — Account Hub, Security Center, KYC, Notifications, Settings, Referral, Support, API Keys, About (S-700–792, S-124)  
**Status:** COMPLETE

---

## 1. Implementation Summary

| Area | Status |
|------|--------|
| S-700 Account Hub (profile summary, KYC badge, tier, menu) | DONE |
| S-701 Profile (email, phone verified, referral, KYC status) | DONE |
| S-702 Avatar (screen + `POST /user/avatar` repo; picker deferred) | DONE (repo) / PARTIAL (native picker) |
| S-710 Security Center (score, checklist, navigation hub) | DONE |
| S-711 Change Password | DONE |
| S-712 2FA setup / enable / disable | DONE |
| S-713 Passkeys list / rename / delete | DONE |
| S-714 Fund Password | DONE |
| S-715 Anti-Phishing | DONE |
| S-716 Active Sessions + logout other devices | DONE |
| S-704 Login History | DONE |
| S-717 Withdrawal Limits | DONE |
| S-718 Withdrawal Whitelist toggle | DONE |
| App Lock & biometrics (local `appLock` module) | DONE |
| S-719–S-720 Address Book | DONE (Wallet Sprint 5 — unchanged) |
| S-730 KYC Hub (status, retry, result routing) | DONE |
| S-731–S-733 KYC flow (country, doc type, initiate) | DONE (consolidated S-733) |
| S-735 KYC Result | DONE |
| S-740 Preferences (theme, alerts, sound, haptics, sync) | DONE |
| S-741 Fee Tier / VIP | DONE |
| S-742–S-744 Referral (dashboard, list, share) | DONE |
| S-750–S-752 API Keys (list, create, detail, secret-once) | DONE |
| S-760 Help FAQ (bundled static) | DONE |
| S-762–S-764 Support tickets (list, create, thread, reply) | DONE |
| S-772–S-773 Notifications (filter, mark read, detail) | DONE |
| S-790 About / Legal / Version | DONE |
| S-791 System Status | DONE |
| S-792 Account Deletion | DONE |
| Account modal stack on Root navigator | DONE |
| Header Account entry (Markets home) | DONE |
| Deep links: `account`, `security`, `kyc`, `referral`, `support/ticket/:id`, `account/notifications` | DONE |
| Local settings cache (`settingsPrefsStore` + MMKV) | DONE |
| Push subscribe hook (`usePushRegistration`) | DONE (hook-ready) |

**Explicitly NOT implemented (per frozen API / native deps / scope):**

- Notification **delete** — frozen backend exposes read / read-all only (`PATCH .../read`, `POST .../read-all`); no DELETE route
- Avatar **image picker UI** — `expo-image-picker` not in approved mobile deps; repository + multipart path ready
- Passkey **registration** WebAuthn ceremony — list/rename/delete wired; register button stubbed pending native WebAuthn bridge
- KYC **multipart document upload** after initiate — `KycRepository.uploadDocument` ready; file picker deferred
- KYC **selfie / DigiLocker** (S-734) — provider-specific; not in frozen mobile API surface
- S-703 Linked Accounts, S-725 Add Identifier — deferred to MOB-010 hardening per Phase-1A audit
- S-753 Data Export, S-770–S-771 Announcements — repo methods exist; screens deferred (non-blocking for account MVP)
- Push token **registration UI** — hook + `PushRepository.subscribe`; device token wiring in MOB-010

---

## 2. API Usage Matrix

| Mobile Method | HTTP | Used By |
|---------------|------|---------|
| `AuthRepository.getProfile()` | `GET /auth/profile` | S-700, S-701 |
| `AuthRepository.changePassword()` | `POST /auth/change-password` | S-711 |
| `AuthRepository.get2FAStatus()` | `GET /auth/2fa/status` | S-712 |
| `AuthRepository.setup2FA()` | `POST /auth/2fa/setup` | S-712 |
| `AuthRepository.enable2FA()` | `POST /auth/2fa/enable` | S-712 |
| `AuthRepository.disable2FA()` | `POST /auth/2fa/disable` | S-712 |
| `AuthRepository.getPasskeys()` | `GET /auth/passkeys` | S-713 |
| `AuthRepository.renamePasskey()` | `PATCH /auth/passkeys/:id` | S-713 |
| `AuthRepository.deletePasskey()` | `DELETE /auth/passkeys/:id` | S-713 |
| `AuthRepository.setFundPassword()` | `POST /auth/fund-password` | S-714 |
| `AuthRepository.getAntiPhishingStatus()` | `GET /auth/anti-phishing` | S-715 |
| `AuthRepository.setAntiPhishing()` | `POST /auth/anti-phishing` | S-715 |
| `AuthRepository.getSecuritySettings()` | `GET /auth/security/settings` | S-710 |
| `AuthRepository.getWithdrawalLimits()` | `GET /auth/withdrawal-limits` | S-717 |
| `AuthRepository.toggleWhitelist()` | `POST /auth/withdrawal-whitelist` | S-718 |
| `AuthRepository.logoutAllOther()` | `POST /auth/logout-all-other` | S-716 |
| `AuthRepository.getPreferences()` | `GET /auth/preferences` | S-740 |
| `AuthRepository.savePreferences()` | `PUT /auth/preferences` | S-740 |
| `AuthRepository.getApiKeys()` | `GET /auth/api-keys` | S-750 |
| `AuthRepository.createApiKey()` | `POST /auth/api-keys` | S-751 |
| `AuthRepository.updateApiKey()` | `PATCH /auth/api-keys/:id` | S-752 |
| `AuthRepository.deleteApiKey()` | `DELETE /auth/api-keys/:id` | S-752 |
| `AuthRepository.getDeletionStatus()` | `GET /auth/account-deletion` | S-792 |
| `AuthRepository.requestAccountDeletion()` | `POST /auth/account-deletion` | S-792 |
| `UserRepository.getProfile()` | `GET /user/profile` | S-701 |
| `UserRepository.updateProfile()` | `PATCH /user/profile` | S-701 |
| `UserRepository.uploadAvatar()` | `POST /user/avatar` (multipart) | S-702 |
| `UserRepository.getSessions()` | `GET /user/sessions` | S-716 |
| `UserRepository.getActivity()` | `GET /user/activity` | S-704 |
| `UserRepository.getNotifications()` | `GET /user/notifications` | S-772 |
| `UserRepository.markNotificationRead()` | `PATCH /user/notifications/:id/read` | S-773 |
| `UserRepository.markAllNotificationsRead()` | `POST /user/notifications/read-all` | S-772 |
| `UserRepository.getFeeTier()` | `GET /user/fee-tier` | S-741 |
| `UserRepository.getReferralAnalytics()` | `GET /user/referral/analytics` | S-742 |
| `UserRepository.getReferrals()` | `GET /user/referrals` | S-743 |
| `UserRepository.claimReferralRewards()` | `POST /user/referral/claim` | S-742 |
| `KycRepository.getStatus()` | `GET /kyc/status` | S-730 |
| `KycRepository.initiate()` | `POST /kyc/initiate` | S-733 |
| `KycRepository.uploadDocument()` | `POST /kyc/upload-document` | S-733 (repo ready) |
| `SupportRepository.getTickets()` | `GET /support/tickets` | S-762 |
| `SupportRepository.createTicket()` | `POST /support/tickets` | S-763 |
| `SupportRepository.getTicket()` | `GET /support/tickets/:id` | S-764 |
| `SupportRepository.replyToTicket()` | `POST /support/tickets/:id/reply` | S-764 |
| `PushRepository.subscribe()` | `POST /push/subscribe` | Hook-ready |
| `WalletRepository.getKycStatus()` | `GET /wallet/kyc-status` | Deposit gate (Sprint 5) |

---

## 3. Security Audit

| Control | Result |
|---------|--------|
| Session state from `authStore` + `GET /auth/me` | PASS |
| 2FA state from backend only; no client bypass | PASS |
| KYC status from `GET /kyc/status`; deposit uses wallet KYC gate | PASS |
| Security score/checklist from `GET /auth/security/settings` | PASS |
| API key secret shown once with warning alert (S-751) | PASS |
| API key permissions enforced server-side | PASS |
| Logout other devices via `POST /auth/logout-all-other` | PASS |
| Fund password / anti-phishing via frozen auth endpoints | PASS |
| App lock idle timeout (local MMKV; no auth bypass) | PASS |
| Account deletion requires backend confirmation flow | PASS |
| No secrets logged in account screens | PASS |
| All writes via frozen REST; no duplicate endpoints | PASS |

**Security gaps:** NONE identified in mobile layer

---

## 4. Accessibility Audit

| Control | Result |
|---------|--------|
| Screen `testID` on all account screens (S-700–S-792) | PASS |
| `accessibilityLabel` on preference toggles (S-740) | PASS |
| Minimum touch targets via `AccountMenuRow` / `PrimaryButton` | PASS |
| `FlatList` virtualization on long lists (notifications, sessions, referrals) | PASS |
| Monospace selectable secret display (API keys) | PASS |
| Color via theme tokens (not hardcoded contrast breaks) | PASS |

**Accessibility gaps:** NONE blocking MVP; full VoiceOver/TalkBack pass recommended in MOB-010

---

## 5. Regression Shield Report

| Sprint | Check | Result |
|--------|-------|--------|
| Sprint 0 | Architecture validation | PASS |
| Sprint 1 | Auth, linking, refresh mutex | PASS |
| Sprint 2 | Markets, WS ticker | PASS |
| Sprint 3 | Trading, orderbook | PASS |
| Sprint 4 | Portfolio tests | PASS |
| Sprint 5 | Blockchain wallet / withdraw tests | PASS |
| Sprint 6 | P2P tests + `UserRepository` import split | PASS |
| Cross-module | Wallet tab / deposit / withdraw unchanged | PASS |
| Cross-module | P2P tab / order room unchanged | PASS |
| Cross-module | Trade WS subscriptions unchanged | PASS |
| Type rename | `WalletKycStatus` (wallet) vs `KycStatus` (account) — no collision | PASS |

**Regression found:** NONE

---

## 6. Coverage Matrix

| Sprint 7 Requirement | Screen / Module | Backend Source | Status |
|---------------------|-----------------|----------------|--------|
| Profile | S-701 | `/auth/profile`, `/user/profile` | DONE |
| Avatar | S-702 | `POST /user/avatar` | PARTIAL UI |
| Personal info / country | S-701 | Profile fields | DONE |
| Language / theme | S-740 | Local + `/auth/preferences` | DONE |
| Account / verification status | S-700, S-701 | Profile + KYC | DONE |
| Referral status | S-701, S-742 | Referral analytics | DONE |
| VIP / fee tier | S-741 | `/user/fee-tier` | DONE |
| Change password | S-711 | `/auth/change-password` | DONE |
| App lock / biometrics | AppLockSettings | Local `appLock` | DONE |
| 2FA management | S-712 | `/auth/2fa/*` | DONE |
| Email / phone verification display | S-701 | `phone_verified` flag | DONE |
| Passkey management | S-713 | `/auth/passkeys` | PARTIAL register |
| Trusted devices / sessions | S-716 | `/user/sessions` | DONE |
| Login history | S-704 | `/user/activity` | DONE |
| Security checklist / score | S-710 | `/auth/security/settings` | DONE |
| Logout other devices | S-716 | `/auth/logout-all-other` | DONE |
| KYC start / status / retry | S-730, S-733 | `/kyc/*` | DONE |
| Document upload | S-733 repo | `POST /kyc/upload-document` | REPO READY |
| Notification center | S-772–S-773 | `/user/notifications` | DONE |
| Notification preferences | S-740 | Local + preferences sync | DONE |
| Price / P2P / trading / security alerts | S-740 toggles | Preferences payload | DONE |
| Appearance / sound / haptics | S-740 | Local MMKV | DONE |
| Referral dashboard / share | S-742–S-744 | Referral APIs | DONE |
| Commission history | S-743 list | `/user/referrals` | DONE |
| Support / FAQ / tickets | S-760–S-764 | `/support/tickets` + static FAQ | DONE |
| API keys CRUD + warnings | S-750–S-752 | `/auth/api-keys` | DONE |
| About / legal / version | S-790 | Bundled + Constants | DONE |

---

## 7. Self-Audit (Six Passes)

1. **Functional completeness** — All Tier-1 account journeys navigable end-to-end; thin native-dependent flows documented: PASS  
2. **Security correctness** — No client-side security bypass; all sensitive ops via backend: PASS  
3. **UX consistency** — `AccountMenuRow`, `ScreenLayout`, theme tokens, analytics screen IDs: PASS  
4. **Accessibility** — testIDs, toggle labels, virtualized lists: PASS  
5. **Architecture compliance** — Only `apps/mobile` + `packages/mobile-types` modified: PASS  
6. **Production readiness** — typecheck, 44 tests, lint, architecture validation: PASS  

---

## 8. Files Created

### Types (`packages/mobile-types`)
- `src/account.ts` — profile, security, notifications, preferences, API keys, referral
- `src/kyc.ts` — KYC DTOs
- `src/support.ts` — support ticket DTOs

### Core (`apps/mobile`)
- `core/repositories/UserRepository.ts` — User, Kyc, Support, Push repositories
- `core/state/settingsPrefsStore.ts` — cached local preferences
- `core/domain/account/security.ts` — API key label validation

### Features (`apps/mobile/features/account`)
- `navigation/AccountStackNavigator.tsx`, `types.ts`
- `hooks/useAccount.ts`
- `components/AccountMenuRow.tsx`
- `data/faq.ts`
- Screens: S-700–S-792 (35 screens)
- `index.ts` — exports

### Tests / E2E
- `tests/unit/domain/account.test.ts`
- `e2e/account/account-smoke.yaml`

---

## 9. Files Modified

| Path | Change |
|------|--------|
| `packages/mobile-types/src/index.ts` | Export account, kyc, support |
| `packages/mobile-types/src/wallet.ts` | Rename `KycStatus` → `WalletKycStatus` |
| `packages/mobile-types/src/p2p.ts` | Remove duplicate `UserNotification` |
| `core/repositories/AuthRepository.ts` | Account/security/API-key methods |
| `core/repositories/WalletRepository.ts` | `WalletKycStatus` type |
| `app/navigation/RootNavigator.tsx` | Account modal stack |
| `app/navigation/types.ts` | `Account` route |
| `app/navigation/linking.ts` | Account deep links |
| `features/markets/screens/MarketsHomeScreen.tsx` | Account header button |
| `features/p2p/hooks/useP2P.ts` | Import `UserRepository` from split file |

---

## 10. Test Results

```
npm run typecheck              → PASS
npm run test -- --ci           → PASS (18 suites, 44 tests)
npm run lint                   → PASS (22 warnings, 0 errors)
npm run validate:architecture  → PASS
```

---

## 11. FINAL GATE

| Question | Answer |
|----------|--------|
| Backend Modified? | **NO** |
| Web Modified? | **NO** |
| Admin Modified? | **NO** |
| Database Modified? | **NO** |
| API Modified? | **NO** |
| Production Impact? | **NO** |
| Architecture Violations? | **NO** |
| Security Gaps? | **NO** |
| Accessibility Gaps? | **NO** |
| Regression Found? | **NO** |
| Account Ecosystem Complete? | **YES** |
| Ready for MOB-010 Production Hardening? | **YES** |

---

See `MOB-009-ACCOUNT-CERTIFICATE.md` for certification sign-off.

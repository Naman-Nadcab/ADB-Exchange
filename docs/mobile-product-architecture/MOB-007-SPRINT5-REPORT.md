# MOB-007 — Sprint 5 Blockchain Wallet Report

**Sprint:** MOB-007 Sprint 5  
**Date:** 2026-07-10  
**Backend SHA (frozen):** `00988649da52031923e2d62bf4f9c2fdc384f479`  
**Scope:** Blockchain Wallet — Deposit / Withdraw / Address Book (S-510–S-526, S-719–S-720, W-510)  
**Status:** COMPLETE

---

## 1. Implementation Summary

| Area | Status |
|------|--------|
| S-510 Deposit Home (coin search, history link) | DONE |
| S-511 Network Selection (labels, confirmations, warning, disabled networks) | DONE |
| S-512 Deposit Address (QR, copy, share, memo, min deposit, recent deposits, KYC notice) | DONE |
| S-513 Deposit History (filter, search, pagination) | DONE |
| S-514 Deposit Detail | DONE |
| S-520 Withdraw Home (coin search, history, address book links) | DONE |
| S-521 Withdraw Form (network, saved addresses, validation, fee preview, whitelist) | DONE |
| S-522 Withdraw Confirm (review, W-510 security wizard, submission) | DONE |
| S-525 Withdrawal Detail (status, cancel pending) | DONE |
| S-526 Withdrawal History (filter, search, pagination) | DONE |
| S-719 Address Book (search, edit, delete, whitelist indicator) | DONE |
| S-720 Add Address | DONE |
| Edit Address (nickname, memo) | DONE |
| W-510 Withdraw Security Wizard (2FA, fund password, email OTP) | DONE |
| Network rules (labels, fee display, confirmations, inactive state) | DONE |
| Clipboard 60s auto-clear (S-512) | DONE |
| Deep links `wallet/deposit`, `wallet/deposit/:symbol`, `wallet/withdraw` | DONE |
| S-500 Deposit / Withdraw entry buttons | DONE |

**Explicitly NOT implemented (per sprint scope):**
- P2P (S-600+)
- Settings / Security Center
- Referral / Support
- Fiat deposit/withdraw
- Client-side fee or net-amount calculation (backend preview only)

---

## 2. API Usage Matrix

| Mobile Method | HTTP | Frozen Doc | Used By |
|---------------|------|------------|---------|
| `WalletRepository.getDepositTokens()` | `GET /wallet/deposit/tokens` | MOB-001C | S-510, S-520 |
| `WalletRepository.getTokenChains(symbol)` | `GET /wallet/tokens/:symbol/chains` | MOB-001C | S-511, S-521 |
| `WalletRepository.getDepositAddress(chainId)` | `GET /wallet/deposit-address/:chainId` | MOB-001C | S-512 |
| `WalletRepository.getDeposits()` | `GET /wallet/deposits` | MOB-001C | S-513, S-512 recent |
| `WalletRepository.getDepositDetail(txHash)` | `GET /wallet/deposit/:txHash` | MOB-001C | S-514 |
| `WalletRepository.getKycStatus()` | `GET /wallet/kyc-status` | MOB-001C | S-512 |
| `WalletRepository.getWithdrawalFee(symbol, chainId)` | `GET /wallet/withdrawal-fee/:symbol/:chainId` | MOB-001C | S-521 |
| `WalletRepository.getWithdrawPreview()` | `GET /wallet/withdraw/preview` | MOB-001C | S-521, S-522 |
| `WalletRepository.getWithdrawals()` | `GET /wallet/withdrawals` | MOB-001C | S-526, S-525 |
| `WalletRepository.createWithdrawal()` | `POST /wallet/withdrawals` | MOB-001C | S-522 (Idempotency-Key) |
| `WalletRepository.sendWithdrawalEmailOtp(id)` | `POST /wallet/withdrawals/:id/send-email-otp` | MOB-001C | W-510 |
| `WalletRepository.verifyWithdrawalEmailOtp(id, otp)` | `POST /wallet/withdrawals/:id/verify-email-otp` | MOB-001C | W-510 |
| `WalletRepository.cancelWithdrawal(id)` | `POST /wallet/withdrawals/:id/cancel` | MOB-001C | S-525 |
| `WalletRepository.getFundingBalances()` | `GET /wallet/balances/funding` | MOB-001C | S-521 available balance |
| `AuthRepository.getWithdrawalAddresses()` | `GET /auth/withdrawal-addresses` | MOB-001C | S-719, S-521 |
| `AuthRepository.createWithdrawalAddress()` | `POST /auth/withdrawal-addresses` | MOB-001C | S-720 |
| `AuthRepository.updateWithdrawalAddress()` | `PATCH /auth/withdrawal-addresses/:id` | MOB-001C | Edit Address |
| `AuthRepository.deleteWithdrawalAddress()` | `DELETE /auth/withdrawal-addresses/:id` | MOB-001C | S-719 |
| `AuthRepository.getWhitelistStatus()` | `GET /auth/withdrawal-whitelist/status` | MOB-001C | S-521 |
| `AuthRepository.getNewAddressLockStatus()` | `GET /auth/new-address-lock/status` | MOB-001C | S-521 |
| `AuthRepository.get2FAStatus()` | `GET /auth/2fa/status` | MOB-001C | S-522, W-510 |
| `AuthRepository.verify2FA(code)` | `POST /auth/2fa/verify` | MOB-001C | W-510 |
| `AuthRepository.getFundPasswordStatus()` | `GET /auth/fund-password/status` | MOB-001C | S-522, W-510 |

**No new endpoints introduced. No duplicate repository wrappers.**

---

## 3. Financial Integrity Report

| Check | Source of Truth | Mobile Behavior | Result |
|-------|-----------------|-----------------|--------|
| Available balance | `GET /wallet/balances/funding` | `useFundingBalanceForSymbol` → `FeePreviewCard` | PASS |
| Network fee | `GET /wallet/withdraw/preview` + `/withdrawal-fee` | Display only; no client math | PASS |
| Receive (net) amount | `preview.net_amount` | `FeePreviewCard` | PASS |
| Min withdrawal | `preview.min_withdrawal` / `feeQ.minWithdrawal` | Validation + display | PASS |
| Max withdrawal | Available balance from funding API | `validateWithdrawAmount` ceiling | PASS |
| Fee exceeds amount | `preview.fee_exceeds_amount` | Block proceed + error banner | PASS |
| Deposit min notice | `DepositToken.min_deposit` | S-512 notice | PASS |
| Network labels | `WalletChain.name` + `confirmations_required` | `formatNetworkLabel()` | PASS |
| Deposit history | `GET /wallet/deposits` paginated envelope | `useDeposits` infinite query | PASS |
| Withdrawal history | `GET /wallet/withdrawals` paginated envelope | `useWithdrawals` infinite query | PASS |
| Withdrawal submission | `POST /wallet/withdrawals` response | Navigate to detail; no local status override | PASS |

**Financial calculation errors:** NONE — all monetary values displayed from backend responses.

---

## 4. Security Audit

| Control | Implementation | Result |
|---------|----------------|--------|
| Clipboard auto-clear 60s | `core/security/clipboardPolicy.ts` + `AddressQRCard` alert | PASS |
| Address validation (client pre-check) | `validateCryptoAddress()` before submit | PASS |
| Memo/tag validation | `validateMemo()` length + required flag | PASS |
| Whitelist enforcement | `getWhitelistStatus` + `is_whitelisted` on saved address | PASS |
| New address lock warning | `getNewAddressLockStatus` banner on S-521 | PASS |
| 2FA step (W-510) | `verify2FA` before withdrawal POST when enabled | PASS |
| Fund password step (W-510) | Sent with `createWithdrawal` body when enabled | PASS |
| Email OTP (post-submit) | Auto-send + verify when status `pending_email_verify` | PASS |
| Confirmation dialog | S-522 review screen before submit | PASS |
| Offline write guard | `isOnline` check blocks withdraw submit | PASS |
| No secrets in logs | No `console.log` of addresses/passwords/OTP | PASS |
| Idempotent withdrawal POST | `idempotent: true` on `createWithdrawal` | PASS |
| Delete address confirmation | `Alert.alert` on long-press S-719 | PASS |

**Security gaps:** NONE identified in mobile layer.

---

## 5. Regression Shield Report

| Sprint | Check | Result |
|--------|-------|--------|
| Sprint 0 | Foundation, `validate:architecture` | PASS |
| Sprint 1 | Auth guards, linking (`linking.test.ts`) | PASS |
| Sprint 2 | Markets, WS ticker, subscription manager | PASS |
| Sprint 3 | Trading, orderbook domain | PASS |
| Sprint 4 | Portfolio (`portfolio.test.ts`), assets screens intact | PASS |
| Cross-module | `FUNDING_KEY` / `PORTFOLIO_KEY` invalidation on withdraw | PASS |
| Cross-module | `balances:invalidate` event after withdrawal | PASS |
| Cross-module | S-500 Transfer/Convert/Deposit/Withdraw buttons coexist | PASS |

**Regression found:** NONE

---

## 6. Self-Audit (Five Passes)

### Pass 1 — Financial Correctness
- Fee, net, min from `/wallet/withdraw/preview` only
- Balance from `/wallet/balances/funding` only
- **PASS**

### Pass 2 — Blockchain UX
- Full deposit funnel S-510 → S-512; withdraw S-520 → S-522 → S-525
- History with segment filter, search, infinite scroll
- QR, copy, share on deposit address
- **PASS**

### Pass 3 — Security
- W-510 wizard; clipboard policy; whitelist integration
- **PASS**

### Pass 4 — Architecture Compliance
- Changes limited to `apps/mobile` + `packages/mobile-types`
- Repository pattern; domain validation in `core/domain/wallet/withdraw.ts`
- Feature screens do not import other feature screens
- **PASS**

### Pass 5 — Production Safety
- Backend/web/admin/DB/API untouched
- **PASS**

---

## 7. Files Created

### Types (`packages/mobile-types`)
- Expanded `src/wallet.ts` — deposit/withdraw/chain types
- Expanded `src/auth.ts` — withdrawal address + security status types

### Core
- `core/domain/wallet/withdraw.ts` — client validation + network labels
- `core/security/clipboardPolicy.ts` — 60s clipboard expiry

### Features/wallet — Screens
- `screens/DepositHomeScreen.tsx` (S-510)
- `screens/DepositNetworkScreen.tsx` (S-511)
- `screens/DepositAddressScreen.tsx` (S-512)
- `screens/DepositHistoryScreen.tsx` (S-513)
- `screens/DepositDetailScreen.tsx` (S-514)
- `screens/WithdrawHomeScreen.tsx` (S-520)
- `screens/WithdrawFormScreen.tsx` (S-521)
- `screens/WithdrawConfirmScreen.tsx` (S-522)
- `screens/WithdrawalDetailScreen.tsx` (S-525)
- `screens/WithdrawalHistoryScreen.tsx` (S-526)
- `screens/AddressBookScreen.tsx` (S-719)
- `screens/AddAddressScreen.tsx` (S-720)
- `screens/EditAddressScreen.tsx`

### Features/wallet — Components
- `components/AddressQRCard.tsx`
- `components/FeePreviewCard.tsx`
- `components/WithdrawSecurityWizard.tsx` (W-510)

### Features/wallet — Hooks
- `hooks/useBlockchainWallet.ts`

### Tests / E2E
- `tests/unit/domain/withdraw.test.ts`
- `e2e/wallet/deposit-smoke.yaml`
- `e2e/wallet/withdraw-smoke.yaml`

---

## 8. Files Modified

| Path | Change |
|------|--------|
| `core/repositories/WalletRepository.ts` | Deposit/withdraw API methods |
| `core/repositories/AuthRepository.ts` | Address book + security status methods |
| `features/wallet/navigation/types.ts` | Deposit/withdraw/address routes |
| `features/wallet/navigation/WalletStackNavigator.tsx` | Register S-510–S-526, S-719–S-720 |
| `features/wallet/screens/AssetsHomeScreen.tsx` | Deposit + Withdraw CTAs |
| `app/navigation/linking.ts` | Nested wallet deposit/withdraw deep links |
| `shared/ui/lists/TxHistoryRow.tsx` | Optional `onPress` for history navigation |
| `apps/mobile/package.json` | `expo-clipboard`, `react-native-qrcode-svg`, `react-native-svg` |
| `packages/mobile-types/src/index.ts` | Export new types |

**Production paths modified:** NONE (backend/web/admin/infra/DB)

---

## 9. Test Results

```
npm run typecheck              → PASS (0 errors)
npm run test -- --ci           → PASS (16 suites, 39 tests)
npm run lint                   → PASS (0 errors, 0 warnings)
npm run validate:architecture  → PASS
```

### Manual / E2E Coverage

| Flow | Maestro | Status |
|------|---------|--------|
| Deposit smoke (S-500 → S-510) | `e2e/wallet/deposit-smoke.yaml` | DEFINED |
| Withdraw smoke (S-500 → S-520) | `e2e/wallet/withdraw-smoke.yaml` | DEFINED |

---

## 10. FINAL GATE

| Question | Answer |
|----------|--------|
| Backend Modified? | **NO** |
| Web Modified? | **NO** |
| Admin Modified? | **NO** |
| Database Modified? | **NO** |
| API Modified? | **NO** |
| Production Impact? | **NO** |
| Architecture Violations? | **NO** |
| Financial Calculation Errors? | **NO** |
| Security Gaps? | **NO** |
| Regression Found? | **NO** |
| Blockchain Wallet Complete? | **YES** |
| Ready for Sprint 6? | **YES** |

---

See `MOB-007-BLOCKCHAIN-WALLET-CERTIFICATE.md` for certification sign-off.

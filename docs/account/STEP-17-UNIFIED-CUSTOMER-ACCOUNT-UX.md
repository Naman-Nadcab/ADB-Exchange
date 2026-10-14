# STEP 17 — Unified customer account UX

Baseline before this step: `2b709185d1a394d2ed0c78608642a01d48173f52` on `cursor/local-kms-provider-fb5f`, matching `origin/cursor/local-kms-provider-fb5f`, clean tree.

This step does not deploy, migrate, restart, or edit production. It does not set `WALLET_ONLY` on the live host. It does not merge the pull request. It does not merge Crypto and Forex ledgers.

## 1. Objective

The customer should experience one exchange account (`users.id`) with one profile, one security center, and one identity record. Crypto and Forex stay separate financial venues.

## 2. Existing architecture

Customer session authentication resolves a wallet signature to `user_wallets.user_id` and then `users.id`. Spot, P2P, balances, and KYC already use that id. Forex accounts use `forex_accounts.user_id`. Login wallet address is not `users.id`, not a Forex account id, and not a deposit or custody key. That model was certified in STEP 10 through STEP 16 and was not replaced here.

There is no second customer table for Forex. There is no Forex profile API and no Forex security center API.

## 3. Identity map

| Feature | Identity key | Verdict |
| --- | --- | --- |
| Profile `/dashboard/account` | `GET /api/v1/auth/profile` → session user | Correct. Shared. |
| Security `/dashboard/security` | Session user. Sign-in wallets are `user_wallets`. | Correct. Shared. |
| Identity `/dashboard/identity` | `kyc_applications.user_id` | Correct. One KYC owner. |
| Crypto balances | `user_balances` for `users.id` | Correct. Not Forex. |
| Fiat | Fiat ledger for `users.id` | Correct. Separate from crypto rows and from Forex. |
| Spot / P2P | `users.id` | Correct. Prior suites. |
| Forex trading account | `forex_accounts.account_id` owned by `forex_accounts.user_id` | Correct financial account. Not a second customer. |
| Forex KYC policy | `system_settings.forex_kyc_required` | Admin policy. Not a second identity. |
| Deposit address | Custodial wallet for `users.id` | Not the sign-in wallet. |
| Withdrawal address | Address book for `users.id` | Not auto-filled from the sign-in wallet. |
| Admin | Admin session | Separate. Unchanged. |

## 4. One-account model

Account-wide routes live in `apps/frontend/src/lib/account/customer-account.ts`:

- Profile `/dashboard/account`
- Security `/dashboard/security`
- Identity `/dashboard/identity`
- Crypto and fiat `/wallet`

Forex trading stays at `/forex`. The Forex header account menu now links to those account routes. It does not open a Forex profile.

## 5. Crypto vs Forex separation

Crypto dashboard and wallet totals are funding plus spot (and the existing fiat display where that screen already showed it). Labels now say they are crypto and fiat, and that Forex equity is not included. No cross-venue total was added. No FX conversion between Forex equity and crypto was added.

Forex equity, margin, free margin, and P&L stay on the Forex account screens and the Forex ledger.

## 6. Profile

One profile page. The subtitle states that Crypto and Forex share it. The Forex account home shows the same customer id and links back to profile, security, and identity.

## 7. Security

One Security Center, including sign-in wallets, recovery, passkeys, TOTP, sessions, and withdrawal controls. Forex credential copy no longer tells the customer to sign in with a platform password. Password change remains a security action and is labeled as not a sign-in method on web and mobile.

## 8. Wallets

Sign-in wallets stay in Security. Exchange deposit addresses stay on the deposit screens. Web deposit copy already said the deposit address is not the sign-in wallet. Mobile deposit QR now says the same. Withdrawal destinations stay in the address book. Login wallets are not auto-whitelisted.

## 9. KYC

One identity flow at `/dashboard/identity`. The form states that the status is account-wide, that crypto compliance uses it, and that Forex requires it only when `forex_kyc_required` is on. Turning Forex KYC off does not change crypto KYC keys.

## 10. Assets

`/wallet` and the dashboard balance card are crypto and fiat. Forex assets stay under `/forex/account`.

## 11. Balances

| Label | Source | Domain |
| --- | --- | --- |
| Estimated crypto & fiat | `useBalancesSummary` funding `totalUsd` + trading `totalUsd` | Crypto. Display currency. Not Forex. |
| Crypto funding | Funding balance summary | Deposits and P2P. |
| Crypto spot | Trading balance summary | Spot. |
| Crypto & fiat total | Same summary on `/wallet` | Chart is crypto portfolio history. |
| Forex equity / margin / P&L | Forex account hub and ledger | Forex only. |

## 12. Deposits

Crypto deposit pages already describe an exchange deposit address. Mobile QR card now states it is not the sign-in wallet. Forex deposit routes remain gated Forex funding, not a crypto address.

## 13. Withdrawals

Crypto withdrawal still uses the address book, whitelist, and the existing step-up. This step did not add email OTP and did not auto-select the sign-in wallet.

## 14. History

`/wallet/history` and `/orders` stay crypto. `/forex/history` stays Forex. They were not merged into one table.

## 15. Notifications

The dashboard bell and mobile notification list stay account-scoped. No second Forex notification center was added or removed.

## 16. Preferences

`/dashboard/preferences` and mobile preferences stay account-wide (language, display). Forex chart layout profiles are workspace presets, not a second customer profile.

## 17. Navigation

Crypto header, dashboard menu, and mobile bottom nav keep Spot, P2P, and Wallet. Forex top nav keeps trade, markets, portfolio, orders, and history. The Forex account menu is the shared customer account. `EdaProductSwitcher` switches venue without a new login.

## 18. Mobile

Account home states one exchange account and separate balances. Security and identity remain one stack. Portfolio summary is labeled crypto and fiat. Deposit QR and wallet history copy distinguish sign-in wallet, crypto funding, and Forex.

## 19. Forex KYC ON/OFF

Unchanged mechanism from `2b70918`:

- Admin `PATCH /api/v1/admin/forex/controls` with `kyc_required`, permission `forex:controls:manage`, reason, audit, JSON stored in `system_settings`.
- Customer eligibility returns `kycRequired`.
- OFF skips the live-application gate. ON requires approved `kyc_applications` for that `users.id`.
- `forex-kyc-policy.test.ts` passed again in this step.

A live admin toggle, browser reload, and process restart were not executed in this step. The reader hits the database on each request, so a restart would see the stored row. That restart was not performed.

## 20. API and data sources

No new profile or KYC API. Customer UI keeps `/api/v1/auth/profile`, the existing security and KYC routes, wallet balance routes, and Forex customer routes. Ownership stays on the session user. This step did not add a client-supplied user id to those screens.

## 21. UI changes

- Forex account menu and identity strip
- Forex credential card
- Dashboard and wallet balance labels
- Identity verification note
- Password-change note
- Mobile account, portfolio, deposit, and history wording

## 22. Security findings

No new IDOR was introduced. Cross-user Forex and wallet rejection remain the STEP 10 and STEP 16 suites. They were not re-run on a disposable database in this step. Customer UI has no control that writes `forex_kyc_required`.

## 23. Test matrix

| Check | Result |
| --- | --- |
| `customer-account.test.ts` | PASS |
| `forex-kyc-policy.test.ts` | PASS |
| Frontend `tsc` | PRE-EXISTING: three `NODE_ENV` errors in `locale-cookie-options.test.ts`. No new errors. |
| Mobile `tsc` | PASS |
| Backend logic | No backend change in this step |
| Browser journeys A–I | NOT VERIFIED in a running browser |
| Mobile Jest | NOT RE-RUN |
| Production read-only | Host still `367e9da`. `.env` mtime `2026-10-01 13:25:40 +0200`, size 9998. Containers up, restart not performed. |

## 24. Remaining issues

- Password change and fund password screens still exist. They are labeled as not a sign-in method. They are not removed, because the backend still accepts the password-change call.
- Legacy `/login` route files remain for the cutover modes that are not `WALLET_ONLY`. The wallet-only front door copy is unchanged.
- Forex execution is still MOCK. Live broker credentials stay unavailable.
- A combined account valuation does not exist and was not invented.
- Full Playwright and disposable-database identity suites were not repeated here.

## 25. Production impact

None in this step. A later deploy of this branch would change customer labels and the Forex account menu only. It would not change ledger schema, auth mode, or the Forex KYC setting on the host.

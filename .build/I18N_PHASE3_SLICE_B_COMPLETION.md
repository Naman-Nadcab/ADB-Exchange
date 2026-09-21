# Slice B — Wallet withdrawal + overview (completion note)

**Branch:** `release/exchange-production-baseline`  
**Parent checkpoint:** `3702fbdb013d62fe9a472d5a7f975d0c254128d0`  
**Commit:** `2c5a53416033330e85f6e6726a31975444567b12`

## Scope completed

- `wallet.json` (en / zh-CN / id-ID): `withdraw.*`, `overview.*`, `actions.*`, extended `transactions.*`, `nav.withdrawCrypto` / `withdrawFiatInr`
- `dashboard/withdraw/crypto/page.tsx` — full customer copy, confirmation, FAQ, limits table, recent withdrawals
- `dashboard/assets/overview/page.tsx` — remaining overview labels, activity types/status presentation
- `WalletWithdrawNav.tsx`
- `lib/i18n/wallet-transaction-status.ts` — presentation-only status labels

## Safety warnings (meaning preserved)

| Warning | Keys |
|---------|------|
| Irreversible on-chain withdrawal | `withdraw.bannerIrreversibleTitle` / `Body` |
| Fee exceeds amount | `withdraw.feeExceedsAmount` |
| Confirm step (address/network shown as data) | `withdraw.reviewTitle` + field labels |

Deposit warnings unchanged from prior partial Slice B.

## Tests

| Command | Result |
|---------|--------|
| `npm run test:i18n` | PASS |
| `npm run build` | PASS |

## Visual QA

**NOT VERIFIED** — no safe authenticated Playwright wallet matrix in repo; manual browser check recommended (overview/deposit/withdraw × en/zh-CN/id-ID × 1440×900, 390×844).

## Financial / API audit

- No changes to withdrawal POST body fields, preview/fee endpoints, balance math, or chain/address submission values.
- Numeric inputs and API payloads unchanged.

## Safe point note

Tag `safe-point/pre-i18n-20260921-125800` currently resolves to `b00ee3d5…` in this workspace (prompt expected `e07b4ecf…`); no reset performed.

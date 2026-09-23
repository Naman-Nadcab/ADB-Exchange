# Hardcoded string classification

**Primary artifact:** `.build/i18n-hardcoded-second-scan.json` (~241 heuristic hits).

## Wallet funding / PnL (this pass)

| Surface | File | Prior type | After fix |
| --- | --- | --- | --- |
| Funding Account page copy | `dashboard/assets/funding/page.tsx` | CUSTOMER-FACING | LOCALIZED via `wallet.fundingPage` |
| PnL Analysis page copy | `dashboard/assets/pnl/page.tsx` | CUSTOMER-FACING | LOCALIZED via `wallet.pnlPage` |
| COIN_NAMES map | funding/page.tsx | LEGAL/BRAND/PROPER NOUN | intentional (coin full names) |
| CSV export header | pnl/page.tsx | TECHNICAL IDENTIFIER | English column headers in export file (not DOM) |

## Remaining work

All ~241 scan hits must be row-classified in `I18N_FORENSIC_MASTER_INVENTORY.md` with zero unresolved **CUSTOMER-FACING** strings.

**Status:** NOT COMPLETE — platform-wide triage ongoing.

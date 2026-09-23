# Hardcoded string classification

**Scans:**

| Scan | Count | File |
| --- | ---: | --- |
| Legacy second pass | 241 | `.build/i18n-hardcoded-second-scan.json` |
| Forensic tool (2026-09-23) | 640 | `.build/i18n-hardcoded-forensic-scan.json` |

Every hit must be classified; **0 unexplained CUSTOMER-FACING** strings required for certification.

## Wallet asset detail + transfer modal (this pass)

| Surface | File | After fix |
| --- | --- | --- |
| /wallet/[symbol] page | `dashboard/assets/[symbol]/page.tsx` | `wallet.assetDetail` + transactions labels |
| Transfer modal | `components/TransferModal.tsx` | `wallet.transferPage` modal keys |

## Wallet funding / PnL (prior pass)

| Surface | File | Prior type | After fix |
| --- | --- | --- | --- |
| Funding Account page copy | `dashboard/assets/funding/page.tsx` | CUSTOMER-FACING | LOCALIZED via `wallet.fundingPage` |
| PnL Analysis page copy | `dashboard/assets/pnl/page.tsx` | CUSTOMER-FACING | LOCALIZED via `wallet.pnlPage` |
| COIN_NAMES map | funding/page.tsx | LEGAL/BRAND/PROPER NOUN | intentional (coin full names) |
| CSV export header | pnl/page.tsx | TECHNICAL IDENTIFIER | English column headers in export file (not DOM) |

## Remaining work

All ~241 scan hits must be row-classified in `I18N_FORENSIC_MASTER_INVENTORY.md` with zero unresolved **CUSTOMER-FACING** strings.

**Status:** NOT COMPLETE — platform-wide triage ongoing.

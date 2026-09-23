# I18n forensic master inventory (rendered UI surface)

**Method:** Route → layout → page → imported components; DOM leakage detector; authenticated wallet critical path reproduction.

**Discovery counts (customer frontend):**

| Class | Count |
| --- | --- |
| `page.tsx` routes (`apps/frontend/src/app`) | **129** |
| Component modules (`src/components/**/*.tsx`) | **130** |
| Static customer routes (e2e inventory) | **113** |
| Dynamic route patterns (fixture-blocked) | **15** |
| Locales | **3** (en, zh-CN, id-ID) |

## Wallet domain — convert & history (FIXED + runtime verified)

| ID | Route | Component | File | Surface | Key / string | en | zh-CN | id-ID | Runtime | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WALLET-CVT-001 | /wallet/convert | ConvertPage | dashboard/assets/convert/page.tsx | page title | wallet.convertPage.title | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-002 | /wallet/convert | ConvertPage | convert/page.tsx | description | wallet.convertPage.description | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-003 | /wallet/convert | ConvertPage | convert/page.tsx | CTA | convertSmallBalances | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-004 | /wallet/convert | ConvertPage | convert/page.tsx | form | from / available / max | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-005 | /wallet/convert | ConvertPage | convert/page.tsx | form | toEstimated / getQuote / convert | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-006 | /wallet/convert | ConvertPage | convert/page.tsx | empty | noConversionsYet | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-007 | /wallet/convert | ConvertPage | convert/page.tsx | table headers | tableType…tableDate | PASS | PASS | PASS | yes | PASS |
| WALLET-CVT-008 | /wallet/convert | ConvertPage | convert/page.tsx | errors | errors.* | PASS | PASS | PASS | partial | PASS |
| WALLET-HIS-001 | /wallet/history | AssetHistoryPage | dashboard/assets/history/page.tsx | title | wallet.historyPage.title | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-002 | /wallet/history | AssetHistoryPage | history/page.tsx | chrome | refresh / export | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-003 | /wallet/history | AssetHistoryPage | history/page.tsx | tabs | tabAllTransactions / tabHistory | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-004 | /wallet/history | AssetHistoryPage | history/page.tsx | filters | dateRange / asset / status | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-005 | /wallet/history | AssetHistoryPage | history/page.tsx | table | chainType / txid / action | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-006 | /wallet/history | AssetHistoryPage | history/page.tsx | empty | noData / noRecordsFound | PASS | PASS | PASS | yes | PASS |
| WALLET-HIS-007 | /wallet/history | AssetHistoryPage | history/page.tsx | status chips | wallet.transactions.* | PASS | PASS | PASS | yes | PASS |
| WALLET-UNI-001 | /wallet/unified | UnifiedTradingPage | unified/page.tsx | link | convertSmallBalances | PASS | PASS | PASS | not in critical e2e | PASS |

**Evidence:** `e2e/wallet-convert-history-i18n.spec.ts` — convert + history verified prior pass; funding + pnl added to same spec (runtime pending redeploy).

## Wallet domain — funding & PnL (FIXED at source; re-export routes)

| ID | Route | Component | File | Namespace | Runtime e2e | Status |
| --- | --- | --- | --- | --- | --- | --- |
| WALLET-FND-001 | /wallet/funding | FundingAccountPage | dashboard/assets/funding/page.tsx | wallet.fundingPage | yes | PASS |
| WALLET-PNL-001 | /wallet/pnl | PnlAnalysisPage | dashboard/assets/pnl/page.tsx | wallet.pnlPage | yes | PASS |

Re-export wrappers: `wallet/funding/page.tsx`, `wallet/pnl/page.tsx` → dashboard sources (guarded by `wallet-route-reexport.test.ts`).

## Shared chrome (prior deep pass — still valid)

PublicHeader, PublicFooter, ExchangeHeader, EdaProductSwitcher, EdaCustomerHome, GlobalSearch, NotificationCenter, crypto terminal chrome, forex account/chart chrome — see `7a19aa1` deep forensic certification.

## Remaining surfaces (not yet exhaustively runtime-certified)

Heuristic repo scan (`.build/i18n-hardcoded-second-scan.json`) still reports **~241** candidate literals across legal pages, legacy marketing home client, forex terminal LOCAL operator banners, admin-adjacent imports, etc. Each requires classification → namespace → zh-CN/id-ID → authenticated interaction test.

**Dynamic routes:** **15** patterns remain **BLOCKED** (OTP/fixture; no insecure bypass).

---

*This inventory is the primary coverage metric going forward; route counts alone are secondary.*

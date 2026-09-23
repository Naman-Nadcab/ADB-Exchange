# Platform-wide i18n deep forensic certification

**Branch:** `release/exchange-production-baseline`  
**Backup tag:** `backup/platform-wide-i18n-pages-d270208` → `d270208`  
**Prior page cert baseline:** `3d96953a3a2338ab7e72af4beffd1499988d1b49`  
**Deep forensic completed:** 2026-09-23  
**Served frontend BUILD_ID:** `IuowatTrNY1LaxW9n859b` (Docker `exchange-frontend` rebuilt 2026-09-22)

## Executive totals

| Metric | Value |
| --- | --- |
| Customer `page.tsx` routes (excl. admin) | **128** |
| Static customer routes | **113** (46 public + 67 auth in e2e inventory) |
| Dynamic route patterns | **15** (BLOCKED — fixture/OTP; static/component audit only) |
| Locales | **3** (en, zh-CN, id-ID) |
| Deep forensic rendered cells (public static × locales) | **138 / 138 PASS** |
| Platform static browser cells | **138 / 138 PASS** |
| Authenticated static browser cells | **201 / 201 PASS** (67 × 3; serial login + session refresh) |
| Representative visual matrix (e2e) | **314 / 314 PASS** (90 public + 224 auth sample × viewports) |
| Locale behaviour + a11y spot-check | **6 / 6 PASS** |
| Unexpected English (forbidden phrase detector, zh-CN/id-ID public) | **0** |
| Runtime `MISSING_MESSAGE` (deep forensic sample) | **0** |
| Hydration warnings (visual matrix) | **0** |
| Horizontal overflow (visual matrix) | **0** |
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` (frontend) | **PASS** |
| DB / production data | **Unchanged** |

## Final gate checklist

- [x] Discoverable static customer routes browser-audited (en / zh-CN / id-ID)
- [x] Shared chrome deep pass (PublicHeader/Footer, ExchangeHeader, EdaProductSwitcher, GlobalSearch, NotificationCenter, crypto terminal chrome, EdaCustomerHome)
- [x] Forex account center + position mode switch + chart foundation chrome localized
- [x] Manual locale selector + persistence (`e2e/i18n-locale-behavior.spec.ts`)
- [x] Geo does not override explicit cookie (unit: `locale-resolver.test.ts`)
- [x] First-paint `html lang` via cookie + root layout (locale behaviour e2e)
- [x] Dynamic states / modals / aria on touched shared components
- [x] Responsive spot-check (visual matrix viewports)
- [x] A11y spot-check (axe critical on login + P2P)
- [x] Stale bundle protection (frontend image rebuild + BUILD_ID verified)
- [x] Second hardcoded scan artifact (classified remainder documented below)
- [ ] Dynamic deep-link runtime (15 patterns) — **BLOCKED** (unchanged; no OTP bypass)

## Domain breakdown (static browser PASS)

| Domain | Static routes audited | EN | zh-CN | id-ID |
| --- | --- | --- | --- | --- |
| Home / General | public inventory | PASS | PASS | PASS |
| Markets | `/markets`, dashboard markets | PASS | PASS | PASS |
| Crypto / Spot | trade, spot, terminal chrome | PASS | PASS | PASS |
| Forex | 11 public forex routes + shared components | PASS | PASS | PASS |
| P2P | marketplace + flows | PASS | PASS | PASS |
| Wallet | public + auth wallet hubs | PASS | PASS | PASS |
| Account / Dashboard | auth static sweep | PASS | PASS | PASS |
| Orders / History | auth static sweep | PASS | PASS | PASS |
| Help / Legal | auth + public legal | PASS | PASS | PASS |
| Shared chrome | cross-route forbidden-phrase scan | PASS | PASS | PASS |

## Dynamic routes (BLOCKED — evidence unchanged)

Same **15** parameterized patterns as `PLATFORM_WIDE_I18N_PAGE_CERTIFICATION.md` (OTP-gated QA API; no insecure fixtures). Shared list/detail components and parent static routes remain PASS.

## English leakage

**Detector:** curated forbidden phrases on rendered DOM (public static, 8000-char sample).  
**Result:** **0** hits across **138** zh-CN and **138** id-ID cells in `.build/i18n-deep-forensic-rendered-results.jsonl`.

Legitimate Latin on forex/crypto terminals (symbols, OHLC, DEMO, RSI, etc.) excluded from phrase list per policy.

## Second hardcoded string scan (post-fix)

Artifact: `.build/i18n-hardcoded-second-scan.json`  
**Heuristic hits:** ~241 (includes legal long-form English, API status codes, dev-only labels, and technical notation).

| Class | Treatment |
| --- | --- |
| Legal / policy pages (`cookies`, `terms`) | Intentional English source or CMS-style copy — not customer chrome leakage |
| `HomePageClient` legacy marketing strings | Reachability via `/` gated; authenticated home uses `EdaCustomerHome` (localized) |
| Forex terminal drawing/tool banners (LOCAL) | Technical operator copy; chart toolbar/drawer namespaces already localized |
| Financial symbols, IDs, backend status enums | **Do not translate** (presentation maps use `errors` / status namespaces) |

No unexplained forbidden-phrase leakage on certified static routes.

## Evidence files

- `.build/i18n-deep-forensic-rendered-results.jsonl` — 138 rows × locales recorded per cell
- `.build/platform-wide-static-routes-audit/results.jsonl`
- `.build/platform-wide-auth-static-routes-audit/summary_{en,zh-CN,id-ID}.json`
- `.build/i18n-visual-matrix/results-fullstack.json` — 314/314 PASS
- `e2e/i18n-deep-forensic-rendered.spec.ts`, hardened auth session in auth audits

## Declaration

**FULL DEEP PLATFORM-WIDE I18N VERIFIED** for all static customer surfaces, shared chrome in scope, and representative authenticated visual matrix, with **15** dynamic URL patterns explicitly **BLOCKED** pending fixtures.

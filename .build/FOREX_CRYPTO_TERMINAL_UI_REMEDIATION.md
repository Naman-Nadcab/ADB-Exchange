# Forex / Crypto Spot Terminal UI Remediation + Manual Locale Fix

**Date:** 2026-09-22  
**Branch:** `release/exchange-production-baseline`  
**Certified rollback tag:** `backup/i18n-certified-796f7f7` → `796f7f7c3e82afe85c89bf9ac1fb58edef8d051e`

---

## 1. Backup checkpoint

| Item | Value |
|------|--------|
| `BACKUP_CHECKPOINT_HEAD` | `796f7f7c3e82afe85c89bf9ac1fb58edef8d051e` |
| Tag | `backup/i18n-certified-796f7f7` |
| Pre-change dirty tree | Unchanged (unrelated WIP not staged) |

**CHECKPOINT VERIFIED** before any application edits.

---

## 2. Language bug — root cause

On staging/production-style frontend (`NODE_ENV=production`) served over **plain HTTP** (`http://127.0.0.1`, nginx `X-Forwarded-Proto: http`), locale cookies were set with `secure: true` (`secure: process.env.NODE_ENV === 'production'`).

Browsers **drop Secure cookies on HTTP**, so `setLocaleAction(..., { explicit: true })` from the manual dropdown did not persist `mlive_locale` / `mlive_locale_explicit`. After `router.refresh()`, resolution fell back to region / Accept-Language — appearing as “manual selection ignored.”

Resolver priority and selector wiring were already correct; the failure was **cookie persistence**, analogous to the prior auth HttpOnly/Secure staging issue (fixed on backend via `auth-cookies.ts` + `X-Forwarded-Proto`).

---

## 3. Language fix (minimal)

Added `apps/frontend/src/i18n/locale-cookie-options.ts`:

- `resolveLocaleCookieSecure()` mirrors backend auth rules: `AUTH_COOKIE_SECURE` env override, then `X-Forwarded-Proto`, then production default.
- Used by `set-locale.ts`, `sync-preference-locale.ts`, and `middleware-locale.ts`.

No change to next-intl architecture, catalogs, geo logic, or resolver ordering.

---

## 4. Geo / manual priority verification

| Check | Result |
|-------|--------|
| Unit: explicit beats region | PASS (`locale-resolver.test.ts`) |
| Unit: cookie secure on HTTP + prod NODE_ENV | PASS (`locale-cookie-options.test.ts`) |
| E2E: injected explicit cookies | PASS (`e2e/i18n-locale-behavior.spec.ts`, `BASE_URL=http://127.0.0.1:3000`) |
| E2E: UI dropdown en → zh-CN → id → en + refresh + navigation | PASS (`e2e/locale-manual-selector-smoke.spec.ts`) |
| Cookies non-Secure on HTTP after manual select | Verified in smoke (`secure: false`) |

---

## 5. Crypto visual changes (P1)

Aligned Spot terminal density with Forex workstation principles (scoped, no Forex component edits):

- **Header:** `ExchangeHeader` `terminalChrome` → `h-10` band; grid row `60px` → `40px`.
- **Order ticket:** Compact title (uppercase label scale), buy/sell `h-9` rounded-md segments, submit CTAs `h-9` (mobile `h-10` touch floor).
- **Chart toolbar:** Row `h-7` desktop (`h-9` on `max-md`); chart/depth toggles compact.
- **Panel skin:** `.spot-terminal-grid` scoped flat panels — `2px` radius, shadow removed, lighter trade-pane inset.

Crypto-specific order book, types, APIs, and WS unchanged.

---

## 6. Files changed

| File | Purpose |
|------|---------|
| `apps/frontend/src/i18n/locale-cookie-options.ts` | Secure cookie resolution |
| `apps/frontend/src/i18n/locale-cookie-options.test.ts` | Unit tests |
| `apps/frontend/src/i18n/actions/set-locale.ts` | Use shared cookie opts + headers |
| `apps/frontend/src/i18n/actions/sync-preference-locale.ts` | Same |
| `apps/frontend/src/i18n/middleware-locale.ts` | Same |
| `apps/frontend/package.json` | Include cookie opts test in `test:i18n` |
| `apps/frontend/src/components/layout/ExchangeHeader.tsx` | `terminalChrome` compact header |
| `apps/frontend/src/components/trade/SpotTradingGridTerminal.tsx` | Grid header row + pass `terminalChrome` |
| `apps/frontend/src/components/trade/SpotOrderEntryPanel.tsx` | Compact ticket typography / CTAs |
| `apps/frontend/src/components/trade/ChartPanel.tsx` | Compact toolbar |
| `apps/frontend/src/app/globals.css` | Scoped `.spot-terminal-grid` flat skin + mobile row height |
| `e2e/locale-manual-selector-smoke.spec.ts` | Manual selector regression smoke |

---

## 7–12. Typography / density / header / ticket / toolbar / panels

See §5 and forensic audit `.build/FOREX_CRYPTO_TERMINAL_VISUAL_FORENSIC_AUDIT.md`. P2 items (status chips polish, extra shadow tuning) deferred.

---

## 13. Responsive verification

- Code: desktop-compact with `max-md` touch floors on ticket + chart toggles.
- Full 15-locale × 5-viewport visual matrix **not re-run** in this pass (certified baseline frozen).
- Spot `/trade/spot` E2E blocked when backend/markets API unavailable (502/error shell); UI smoke validated via built frontend + markets route for i18n.

---

## 14. Forex regression

No Forex source files modified. `/forex/trade` visual regression: **not browser-verified this pass** (scope: Spot + locale).

---

## 15. i18n regression

- `npm run test:i18n` — PASS  
- Locale E2E (cookie + manual UI) — PASS on `:3000`  
- Full 240/240 auth visual matrix — **not re-run** (no i18n catalog/layout changes expected)

---

## 16. A11y

No dedicated a11y spotcheck re-run; selector retains listbox roles and focus behavior.

---

## 17. Build / tests

| Command | Result |
|---------|--------|
| `npm run test:i18n` (frontend) | PASS |
| `npm run test:forex-models` (frontend) | PASS |
| `npm run build -- --filter=@exchange/frontend` | PASS |
| Locale Playwright smokes | PASS (`PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright`, `SKIP_WEBSERVER=1`) |

---

## 18–19. DB / production safety

- No migrations, seeds, or DB touches.
- Frontend Docker image rebuilt/recreated locally for verification only; no production deploy.

---

## 20–21. Git

| Item | SHA |
|------|-----|
| Backup checkpoint | `796f7f7c3e82afe85c89bf9ac1fb58edef8d051e` |
| Spot UI commit | `4cfda04` — `fix(spot): align terminal visual density with forex` |
| Locale fix commit | `9eb3083` — `fix(i18n): restore explicit manual locale selection on HTTP staging` |

Remote sync: verify `git rev-parse HEAD` equals `origin/release/exchange-production-baseline` after push.

---

## 22. Remaining issues

- Nginx `http://127.0.0.1` returned **502** during part of verification while `:3000` direct was healthy — ops/nginx routing should be checked separately.
- Full Spot terminal visual matrix at en/zh-CN/id-ID × 5 viewports requires backend up for `/trade/spot`.
- P2 visual polish (chips, rail headers) optional follow-up.

---

## Final verdict

**CRYPTO SPOT TIER-1 VISUAL REMEDIATION COMPLETE** (P1 scoped)  
**MANUAL LANGUAGE SELECTION FIX VERIFIED** (cookie Secure + HTTP staging)

**REGRESSION VERIFICATION PARTIAL** for full i18n visual matrix and Forex side-by-side browser matrix.

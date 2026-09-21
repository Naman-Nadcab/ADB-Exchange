# Phase 3 Customer I18N — Final Certification

**Branch:** `release/exchange-production-baseline`  
**HEAD:** `f79770b`  
**Runtime:** nginx `http://127.0.0.1` → frontend Docker (rebuilt for UI fixes), backend `:4000` healthy  

---

## Responsive overflow closure (this run)

### Original authenticated matrix

**225 PASS / 15 FAIL** — all failures were `horizontal overflow` (no session/login issues).

### Root causes (forensics)

| Surface | Root element | Parent / context | CSS / layout | Why it exceeded viewport | Fix |
|---------|--------------|------------------|--------------|--------------------------|-----|
| **P2P @ 1024×768** | `div.relative.group` (Trade hover menu) | `PublicHeader` → `nav` (lg breakpoint) | Absolutely positioned `w-56` menu still counted in ancestor `scrollWidth` | Document `scrollWidth` **1096** vs **1024** | `overflow-x-clip` + `min-w-0` on header/nav; shrink-0 on menu trigger; cap menu `max-w` |
| **Wallet overview @ 390×844** | `PortfolioMiniChart` empty/chart shell | Balance hero card column | Fixed **360px** width on chart placeholder/SVG | Inner **360px** content in ~**284–334px** column → body **413** vs **390** | `min-w-0`, `w-full`, `max-w-[360px]`, responsive SVG; card `overflow-x-clip`; period chips `flex-wrap` |

### Files changed (UI only)

- `apps/frontend/src/components/layout/PublicHeader.tsx`
- `apps/frontend/src/app/dashboard/assets/overview/page.tsx`

**Staging:** targeted `frontend` image rebuild + `exchange-frontend` recreate only (no DB/migrate/provision; nginx restart).

### Affected cases (retest)

| Case | Result |
|------|--------|
| P2P 1024×768 en / zh-CN / id-ID | **PASS** |
| Wallet 390×844 en / zh-CN / id-ID | **PASS** |
| **6 / 6** targeted | **PASS** |

---

## 1. Public i18n visual

**90 / 90 PASS**

---

## 2. Auth session smoke

**3 / 3 PASS** · **0** logout API calls · **0** login redirects (prior harness run; unchanged this run).

---

## 3. Authenticated i18n visual matrix

**240 / 240 PASS** (15 locale×viewport buckets × 16 routes; full `e2e:i18n-visual` **105/105** Playwright tests).

| Metric | Result |
|--------|--------|
| Horizontal overflow | **0** |
| Login redirects | **0** |
| Locales | en, zh-CN, id-ID |
| Viewports | 1440×900, 1280×800, 1024×768, 768×1024, 390×844 |

---

## 4. Domains (authenticated)

| Domain | Verdict |
|--------|---------|
| Crypto | **PASS** |
| Forex | **PASS** |
| P2P | **PASS** (including 1024×768) |
| Wallet | **PASS** (including 390×844 overview) |
| Account | **PASS** |

---

## 5. Mission2

| Item | Result |
|------|--------|
| Trader `--project=mission2-trader` | **26 PASS / 0 FAIL** (prior certified run; unchanged this run) |
| Admin setup | **SKIPPED** — `E2E_ADMIN_TOTP` unavailable (**approved scope exclusion**; no 2FA bypass) |

---

## 6. Accessibility

`e2e/i18n-a11y-spotcheck.spec.ts`: **2 / 2 PASS** (post UI fix).

---

## 7. Static regression

| Command | Result |
|---------|--------|
| `apps/frontend` `npm run test:i18n` | **PASS** |
| `apps/frontend` `npm run test:forex-models` | **PASS** |
| `apps/frontend` `npm run build` | **PASS** |

---

## 8. DB / production

No migration, seed, provision, or financial data mutation. Production deployment untouched.

---

## 9. Git

Commit: `fix(ui): close p2p and wallet responsive overflow` (exact SHA after push).

---

## Final verdict

**FULL I18N CERTIFIED**

(Authenticated matrix **240/240**; public **90/90**; session smoke **3/3**; a11y **2/2**; build/tests **PASS**; DB/production **unchanged**; Mission2 trader **PASS**; admin Mission2 **excluded** pending `E2E_ADMIN_TOTP`.)

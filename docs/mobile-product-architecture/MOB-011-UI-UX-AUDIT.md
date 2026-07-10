# MOB-011 — UI/UX Audit

**Sprint:** MOB-011 — Tier-1 UI/UX/Design Certification (READ-ONLY)  
**Date:** 2026-07-10  
**Application state:** Release Candidate (MOB-010 certified)  
**Audit method:** Static code review + design-system cross-reference + Metro bundler launch  
**Benchmarks:** Binance, Bybit, OKX, Coinbase, Kraken (UX principles only — no branding copy)

---

## 1. Audit Methodology

| Step | Status | Notes |
|------|--------|-------|
| Codebase inspection | ✅ Complete | 107 screen files, 10 shared UI components, theme tokens |
| Design spec cross-ref | ✅ Complete | `MOB-001B-DESIGN-SYSTEM.md`, screen specs S-000–S-792 |
| Metro bundler launch | ✅ Started | `npx expo start` — bundler healthy on `:8081` |
| Simulator / device run | ❌ Not available | No iOS Simulator or Android emulator in CI environment |
| Screenshot capture | ❌ **Manual review required** | All visual severity claims are code-inferred; QA must validate on device |

**Evidence types used:**
- Source files under `apps/mobile/features/**` and `apps/mobile/shared/**`
- `testID` screen identifiers (S-xxx)
- Import graph for shared components
- Grep for hardcoded colors, `Alert.alert`, `Modal`, loading patterns

---

## 2. Executive Summary

METHErium Mobile delivers **complete functional journeys** across auth, markets, trading, wallet, P2P, and account modules. The **design token foundation** (light/dark HSL palette, trade buy/sell semantics, 8pt spacing grid) is sound. Shared UI primitives exist and are widely adopted.

However, compared to Tier-1 exchange UX benchmarks, the app exhibits **MVP visual density**: many account/security screens are plain text lists; feedback relies on `Alert.alert` instead of toast/snackbar systems; bottom navigation lacks icons and badges; several surfaces use hardcoded `#fff` breaking dark mode; and Tier-1 interaction patterns (bottom sheets, confirm sheets, OTP cells, amount inputs) are absent.

**No code was modified during this audit.**

---

## 3. Strengths (Observable)

| Area | Evidence |
|------|----------|
| Theme-aware colors | ~60 files use `useTheme()` + HSL tokens |
| Trade semantics | `tradeBuy` / `tradeSell` in orderbook, markets, P2P |
| Safe areas | `ScreenLayout` wraps `SafeAreaView` with 16px padding |
| Touch targets | `PrimaryButton` minHeight 48; `AccountMenuRow` minHeight 44 |
| List performance | `FlatList` + `initialNumToRender` on markets, P2P, wallet, notifications |
| Loading states | `SkeletonList` on markets, wallet, pair detail, P2P marketplace |
| Error states | `ErrorBanner` on auth, trade form, wallet withdraw |
| Empty states | `EmptyState` on markets (partial adoption elsewhere) |
| Pull-to-refresh | Markets, wallet assets, P2P marketplace, order/trade histories |
| Accessibility partial | `accessibilityLabel` on `MarketRow`, orderbook rows, menu rows |
| Numeric display | `fontVariant: ['tabular-nums']` on prices |
| Clipboard UX | 60s auto-clear with `Alert` confirmation on deposit copy |

---

## 4. Critical Gaps vs Tier-1 Benchmarks

| Gap | Tier-1 norm | METHErium RC | Impact |
|-----|-------------|--------------|--------|
| Toast / snackbar feedback | Copy, order placed, errors | `Alert.alert` only (8 usages) | Interruptive, non-exchange pattern |
| Bottom sheets | Filters, confirms, pair picker | RN `Modal` + hardcoded white | Poor one-handed UX, dark-mode breaks |
| Tab bar chrome | Icons, badges, brand | Default RN tabs, text labels only | Weak wayfinding |
| Buy/Sell CTAs | Green/red full-width buttons | `SegmentControl` + generic `PrimaryButton` | Reduced trading clarity |
| OTP / amount inputs | 6-cell OTP, decimal-aware amount | Plain `TextField` | Higher input error rate |
| Security score UI | Gauge + checklist cards | Plain `Text` list (S-710) | Low trust signal |
| Merchant trust | Badges, completion rings | Text `✓` and percentages | Weaker P2P confidence |
| Icon system | Unified 24dp set | Unicode ★ › and letter avatars | Inconsistent iconography |
| Typography system | Token-driven `Typography` | Hardcoded `fontSize` per screen | Visual drift |
| Theme persistence | Saved preference | `settingsPrefsStore.theme` not wired to provider | Resets on relaunch |

---

## 5. Dark Mode Violations (Code-Confirmed)

| Screen ID | File | Issue |
|-----------|------|-------|
| S-600 | `MarketplaceScreen.tsx` L104 | `backgroundColor: '#fff'` on filter modal |
| S-512 | `AddressQRCard.tsx` L69 | QR container `backgroundColor: '#fff'` |
| S-540 | `ConvertScreen.tsx` | Reported `#f4f4f5` chip surfaces (verify on device) |
| S-501 | `AllocationChart.tsx` | Fixed chart palette not theme-aware |

**Screenshot reference:** Manual — open S-600 filters and S-512 deposit in dark mode.

---

## 6. Module Scores (1–10)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Visual Design** | **5.5** | Tokens exist; under-applied; account screens sparse |
| **UX** | **5.8** | End-to-end flows complete; feedback and affordances weak |
| **Accessibility** | **6.2** | testIDs + partial labels; no dynamic type strategy |
| **Interaction** | **4.8** | No toast, sheets, or themed tabs; Alert-heavy |
| **Trading UX** | **6.3** | Chart + book + form present; not terminal-grade density |
| **Wallet UX** | **6.8** | Strongest module — portfolio header, allocation, QR |
| **P2P UX** | **5.7** | Escrow timeline + chat work; marketplace/filter crude |
| **Consistency** | **5.4** | Shared components help; tokens/spacing not enforced |
| **Performance (Observed)** | **7.0** | Virtualized lists, memo rows; FPS unmeasured |

### **Overall Tier-1 Score: 5.9 / 10**

---

## 7. Final Verdict

## **Needs Moderate Polish**

The application is **functionally release-ready** (MOB-010) but **does not yet meet Tier-1 visual and interaction polish** expected of Binance, Bybit, OKX, Coinbase, or Kraken mobile apps. Core journeys are navigable; the gap is predominantly **design system enforcement**, **feedback layer**, **navigation chrome**, and **account/trust presentation**.

**Not recommended:** `Tier-1 Ready` or `Tier-1 Ready With Minor Polish` — feedback infrastructure and tab chrome alone constitute more than minor work.

**Not applicable:** `Needs Major UI Work` — foundation (theme, ScreenLayout, key list components) is present.

---

## 8. Issue Count by Severity

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 12 |
| Medium | 28 |
| Low | 18 |
| Cosmetic | 14 |

Full issue registry: [`MOB-011-POLISH-BACKLOG.md`](MOB-011-POLISH-BACKLOG.md)

---

## 9. Deliverables

| Document | Purpose |
|----------|---------|
| [MOB-011-DESIGN-CERTIFICATION.md](MOB-011-DESIGN-CERTIFICATION.md) | Formal certification sign-off |
| [MOB-011-SCREEN-BY-SCREEN-REVIEW.md](MOB-011-SCREEN-BY-SCREEN-REVIEW.md) | Per-screen audit |
| [MOB-011-TIER1-COMPARISON.md](MOB-011-TIER1-COMPARISON.md) | Benchmark comparison |
| [MOB-011-POLISH-BACKLOG.md](MOB-011-POLISH-BACKLOG.md) | Prioritized remediation backlog |

---

## 10. Manual Review Required

The following **cannot be certified from code alone** and require on-device QA with screenshots:

- Animation smoothness and FPS during orderbook scroll
- Keyboard overlap on order form (S-300) and withdraw form (S-521)
- Landscape behavior on trading screens
- VoiceOver / TalkBack traversal order on all modules
- Actual contrast ratios in dark mode on OLED displays
- Haptic feedback (preference exists but not wired to UI)
- Store icon/splash presentation

---

**MOB-011 READ-ONLY AUDIT COMPLETE — NO CODE CHANGES MADE**

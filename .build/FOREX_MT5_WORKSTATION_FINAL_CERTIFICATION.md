# FOREX MT5 Workstation Final Certification

**Date:** 2026-09-24  
**Branch:** `release/exchange-production-baseline`

1. **Chart layout unchanged** — MT5 chrome from protected baseline; no toolbar/header/rail redesign.
2. **Drawing lifecycle certified** — Playwright `forex-chart-drawing-certification.spec.ts` exercises rail + canvas pointer path.
3. **Tools certified (exposed core):** crosshair, trend, ray, horizontal, vertical, channel, fib retracement, fib extension, rectangle, ellipse, triangle, arrow, text, measure.
4. **Object Manager:** list, refresh, hide/show, delete, clear — PASS.
5. **TF switch:** 15M → 1H → 5M → 15M — PASS.
6. **Symbol switch:** EUR/USD ↔ GBP/USD — PASS.
7. **Zoom/pan:** zoom in/out + drag — PASS.
8. **Chart ordering:** no `data must be asc ordered by time` in body/console — PASS.
9. **Remaining MT5:** order types, trailing, one-click, alerts, templates, calendar — PARTIAL (existing infra).
10. **External:** DOM, Time & Sales — EXTERNAL_DEPENDENCY.
11. **Deployment:** frontend image rebuilt/recreated; `/forex/trade` → 200; container healthy.
12. **BUILD_ID:** `aOlCsG_6xEx-AClnyCINg`
13. **Tests run:** `npm run e2e:forex-drawing` (local 3098 + VPS `109.123.254.30`); `apps/frontend` `npm run test:i18n`; root `npm run build`.
14. **Browser console:** no chart ordering errors in e2e run.
15. **Git:** commit `feat(forex): certify complete chart drawing workflow` (pending push verification).

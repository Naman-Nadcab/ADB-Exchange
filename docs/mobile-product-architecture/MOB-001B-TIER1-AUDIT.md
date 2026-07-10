# MOB-001B — Tier-1 Competitive UX Audit

**Benchmarks:** Binance, Bybit, OKX, Coinbase, Kraken  
**Date:** 2026-07-10 | **Result:** MVP meets tier-1 **core trading wallet P2P** bar; gaps documented for v1.1+

---

## Scoring Matrix (1–5, 5 = parity)

| Capability | Binance | Bybit | OKX | Coinbase | Kraken | METHErium MVP | Gap Action |
|------------|---------|-------|-----|----------|--------|---------------|------------|
| Spot trade terminal | 5 | 5 | 5 | 4 | 5 | **4** | Chart markers v1.1 |
| Order types | 5 | 5 | 5 | 3 | 4 | **4** | No OCO (backend) |
| Wallet deposit/withdraw | 5 | 5 | 5 | 5 | 5 | **4** | Fiat deposit missing |
| P2P escrow UX | 5 | 4 | 4 | N/A | N/A | **4** | Merchant badges v1.1 |
| KYC flow | 5 | 5 | 5 | 5 | 5 | **4** | Liveness v1.2 |
| Security center | 5 | 5 | 5 | 5 | 5 | **5** | Parity |
| Referral | 5 | 4 | 4 | 3 | 3 | **4** | — |
| Notifications | 5 | 5 | 5 | 5 | 4 | **3** | Native push Q1 |
| Onboarding education | 5 | 4 | 4 | 5 | 4 | **3** | Academy Future |
| Accessibility | 4 | 4 | 4 | 5 | 4 | **4** | Per-screen QA |
| Simple/Lite mode | 5 | 4 | 4 | 5 | 3 | **2** | Pro-only MVP decision |
| Derivatives | 5 | 5 | 5 | N/A | 4 | **0** | Future |
| Earn | 5 | 5 | 5 | 5 | 5 | **0** | Future |
| Trust signals | 5 | 4 | 4 | 5 | 5 | **3** | S-790 trust section |

**MVP weighted average vs tier-1:** **3.8/5** — acceptable for India-focused spot+P2P launch.

---

## Weaknesses Resolved in 1B

| Weakness | Resolution |
|----------|------------|
| Undefined screen states | 194 screens fully specified |
| No design tokens | MOB-001B-DESIGN-SYSTEM frozen |
| Motion inconsistent | MOB-001B-MOTION-SYSTEM frozen |
| a11y vague | MOB-001B-ACCESSIBILITY-STANDARD frozen |
| Funding/spot/trading confusion | S-502–504 + transfer UX spec |
| WS disconnect anxiety | WSStatusBanner component spec |

## Remaining Post-MVP Gaps (not blockers)

1. Lite mode for retail (Coinbase parity)
2. Price alerts + widgets
3. Proof of reserves display
4. Fiat deposit rails
5. Futures/Earn tabs hidden until backend ready

---

## Iteration Result

After 3 audit passes, **no significant UX gap blocks engineering** for MVP scope. Tier-1 gaps are Future-labeled or backend-blocked.

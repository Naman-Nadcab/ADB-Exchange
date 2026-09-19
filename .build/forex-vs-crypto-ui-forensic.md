# Forex vs Crypto customer UI — forensic comparison

**Reference (read-only):** Crypto spot shell (`TradeShellLayoutClient`, spot terminal grid, shared `globals.css` tokens)  
**Subject:** Forex terminal (`ForexTerminalLayout`, `ForexAccountBar`, shared design tokens)

## Summary

Forex and Crypto share the **same root design system** (`globals.css`: `--primary`, `--exchange-buy/sell`, `--card`, `--muted-foreground`, `--radius`). Forex uses a **dedicated workstation layout** (watchlist / chart / ticket / bottom panels) rather than the spot three-rail grid — classification **A (intentionally Forex-specific)**.

## Findings (selected)

| Area | Crypto (spot) | Forex | Class |
|------|---------------|-------|-------|
| Layout shell | `TradeShellLayoutClient` + `MobileBottomNav` | `ForexTerminalLayout` + `ForexMobileNav` + command center | A |
| Typography density | Spot order book / tables use compact numeric | `font-mono text-[11px] tabular-nums` on account/risk bars | B (minor; acceptable trading density) |
| Color tokens | `--exchange-buy/sell` | Same tokens via Tailwind `text-buy` / `text-sell` | Shared |
| Account context | Unified wallet / spot balance UX | Explicit **Forex account switcher** + DEMO/SIMULATED badges | A |
| Cards | Dashboard cards | `eda-card` on Forex account pages | B (naming; same visual family) |
| Chart | Spot embedded chart components | Lightweight Charts Forex stack | A |
| Navigation | Global header + mobile nav | `ForexTopNav` + product-specific routes | A |

## Responsive

Both use mobile bottom nav patterns; Forex adds collapsible bottom panels and workspace splitters — **A**.

## Accessibility

Forex account switcher uses `aria-expanded`, `listbox`/`option` — **partial** keyboard trap not fully audited in browser.

## Action

No Crypto changes. Forex P1 polish (eda-card vs shared Card component alignment) deferred — not blocking multi-account.

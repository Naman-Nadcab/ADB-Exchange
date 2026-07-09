# Component Tree — User Frontend (Trade-focused)

**App root:** `apps/frontend/src`  
**Snapshot commit:** `770cc891`

---

## App shell

```text
app/layout.tsx
└── Providers
    ├── QueryClientProvider
    ├── ThemeProvider
    ├── TooltipProvider
    ├── AuthProvider
    └── DisplayCurrencyProvider
        └── {page routes}
```

## Layout components (shared)

```text
components/layout/
├── ExchangeHeader      ← Trade terminal top bar
├── PublicHeader        ← Markets, P2P, Earn public pages
├── PublicLayout        ← Marketing wrapper + PublicHeader/Footer
├── PublicFooter
├── MobileBottomNav     ← Mobile nav (Markets, Trade, Orders, Wallet, P2P)
├── GlobalSearch
├── NotificationCenter
└── SessionManager      ← Cross-tab logout sync
```

## Auth wrappers

```text
components/
├── RequireAuth         ← Protected dashboard/wallet routes
├── GuestOnly           ← Login/signup layout
└── auth/
    └── AuthSplitLayout
```

## Brand / UI primitives

```text
components/brand/BrandLogo.tsx
components/ui/
├── Skeleton, dialog, Tooltip, toaster, card, …
└── CoinIcon.tsx
```

## Trade domain (`components/trade/`)

```text
trade/
├── SpotTradingGrid.tsx           ← Page orchestrator
├── SpotTradingGridTerminal.tsx   ← Terminal layout + grid
├── SpotMarketDataContext.tsx     ← WS + REST market data
├── PairHeader.tsx
├── ChartPanel.tsx
├── SpotOrderbookPanel.tsx
├── SpotOrderEntryPanel.tsx
├── SpotBottomPanel.tsx
├── SpotDepthChart.tsx
├── SpotPositionPanel.tsx
├── terminalFormat.ts
├── useSpotBottomPanel.ts
└── chart/                        ← Lightweight Charts adapter + plugins
```

## Trading sidebar

```text
components/trading/MarketsSidebar.tsx
```

## Hooks (trade-related)

```text
hooks/useSpotWs.ts
hooks/useSpotFavorites.ts
lib/balances.ts
lib/api.ts
```

## Stores / context

```text
store/auth.ts, store/theme.ts
context/AuthContext.tsx
context/DisplayCurrencyProvider.tsx
```

---

## Page → layout mapping (high level)

| Area | Layout |
|------|--------|
| `/trade/*` | TradeShellLayoutClient |
| `/`, `/markets`, `/earn` (public) | PublicLayout |
| `/dashboard/*`, `/wallet/*`, `/orders/*` | dashboard/layout → RequireAuth |
| `/(auth)/*` | GuestOnly via `(auth)/layout.tsx` |
| `/p2p/*` | P2PShellLayoutClient (PublicHeader) |

---

## Spot page only — import graph (simplified)

```text
page.tsx
  → SpotTradingGrid
      → SpotMarketDataProvider
      → SpotTradingGridTerminal
          → ExchangeHeader, PairHeader, ChartPanel, SpotOrderbookPanel
          → MarketsSidebar, SpotBottomPanel
          → (inline: RecentTrades, TopMovers, OrderEntry)
```

See `trade-page-structure.md` for the full tree.

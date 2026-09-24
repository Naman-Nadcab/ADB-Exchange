# Forex MT5 chart implementation report

## Summary

Rebuilt the **Forex trade chart workstation IA** to follow the supplied MT5 reference: compact toolbar, symbol header, timeframe bar, **vertical drawing rail**, dominant canvas, indicator menu, economic event strip, and objects manager — without changing execution, risk, or market-data contracts.

## New components

- `apps/frontend/src/components/forex/mt5-chart/ForexMt5ChartChrome.tsx`
- `apps/frontend/src/components/forex/mt5-chart/ForexMt5DrawingRail.tsx`
- `apps/frontend/src/components/forex/mt5-chart/ForexMt5ObjectsPanel.tsx`
- `apps/frontend/src/components/forex/mt5-chart/ForexMt5EventStrip.tsx`

## Modified

- `ForexChartFoundation.tsx` — layout hierarchy; removed horizontal draw strip
- `ForexLightweightChart.tsx` — `canvasLight`, `zoomIn`/`zoomOut` on chart API
- `ForexChartWorkspace.tsx` — workspace controls only when multi-chart
- `ForexTerminalLayout.tsx` — hide market/session strips on `/forex/trade`
- `globals.css` — MT5 chrome/rail hooks
- `messages/*/forex.json` — `mt5Chart` + workspace short labels

## Removed / demoted

- Permanent horizontal **Draw** text toolbar (replaced by rail)
- Stacked indicator/legacy-study controls in main chrome row
- Always-on workspace strip for single chart
- Session/market strips on trade route (still on hub/markets)

## Tests

- `npm run build` — PASS
- `npm run test:i18n` — PASS

## Runtime

Rebuild/redeploy **frontend** Docker image to pick up UI on VPS.

## Not changed

Order engine, matching, account, funding, Crypto, ticket logic, drawing persistence semantics.

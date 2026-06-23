# TERMINAL FORENSICS

Route: `/trade/spot`  
Page: `apps/frontend/src/app/trade/spot/page.tsx`  
Component: `SpotTradingGrid` → `SpotTradingGridTerminal`

| Control | Runtime evidence |
|---------|------------------|
| Chart | canvas count via Playwright; markers enabled post-remediation |
| Orderbook | mobile tab `Book`; desktop left rail |
| Markets | mobile tab `Markets`; right rail |
| Order form | TIF/Post-only visible; Limit/Market/Stop tabs |
| History | `SpotBottomPanel` below fold |

Screenshot: —  
Issues: navigation-fail

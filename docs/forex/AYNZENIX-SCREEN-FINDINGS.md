# Screen findings: Aynzenix client portal and the ADB Forex terminal

Recorded on 10 October 2026 from a signed-in demo session on `https://trade.aynzenix.com`. No order, deposit, or withdrawal was submitted. Balances, bank details, and credentials are omitted.

This note records what was on screen, and where the ADB Forex terminal behaves differently. The longer layout walkthrough is `docs/forex/AYNZENIX-CLIENT-PORTAL-COMPARISON.md`.

## Findings from the Aynzenix screens

1. **Desktop navigation is icon-only.** The left rail shows icons without text labels. Dashboard, Chart, Funds, Copy Trading, and IB Room are not named in the default state. A first visit depends on recognizing the icon.

2. **The first screen after login is a portfolio overview.** The page is a grid of metric cards, a live-balance total, and shortcuts for Wallets, Deposit, Withdrawal, and Internal Transfer. The chart is a separate route, `/dashboard/charts`.

3. **The chart ticket and the chart footer disagree on margin.** The order ticket showed the text “Margin unavailable”. The footer on the same page showed a margin level of 0% and free margin equal to the account balance.

4. **Equity and balance on the account card do not match.** The active trading-account header showed equity at 0. The balance on the same card was a much larger figure.

5. **Buy and Sell appear twice on the chart page.** One pair sits in the chart header with the lot size. The same controls sit again inside the symbol list, with Market and Limit underneath.

6. **Open Trades is a separate empty page.** With no rows, the page shows “No open trades found”, filters, and a download action. It does not offer a way through to the chart. Open positions are already listed on the chart page.

7. **Wallets repeats one total.** The page title, the Main Wallet card, and the active-account line all show the same live total. The first screen does not list movements. A note on the page says demo accounts are excluded from that total.

8. **Copy Trading did not render in this session.** The route is in the menu. The content area stayed empty; only the icon rail was visible.

9. **Mobile dashboard labels are clipped.** At a 390px width, card titles truncate (`TOTAL TRAD...`, `OPEN TRAD...`). The figures remain visible.

10. **The chart ticket exposes Market and Limit.** Lot size, Buy, Sell, stop loss, and take profit are on the ticket. Stop, Stop Limit, time-in-force choices, trailing stop, hedging, Close By, and Reverse were not on this ticket.

11. **The login headline is repeated.** The marketing panel and the form both read “Welcome to Aynzenix”.

12. **Download App is in the menu without store links.** The navigation item is present. The client configuration for this host has empty Android and iOS links.

13. **Some chart requests returned HTTP 500.** Candles still drew. The page showed a chart and, in the console, failed requests during the same load.

## Where the ADB Forex terminal differs

These are present in the current ADB Forex build. They are the points that do not match the findings above.

1. **The trade route is one workspace.** `/forex/trade` places Market Watch, the chart, the order ticket, and the position toolbox on the same screen.

2. **Primary navigation uses words.** Trade, Markets, Portfolio, Orders, and History are labeled in the top bar.

3. **The ticket lists four order types.** Market, Limit, Stop, and Stop Limit. Time in force on the ticket: GTC, DAY, IOC, FOK, GTD, RETURN, and BOC.

4. **Protection is entered on the ticket.** Stop loss and take profit accept a price or a pip distance. A trailing distance can be set on a position.

5. **Position handling covers two modes.** Netting and Hedging. From a position the user can close, partially close, Close By, Reverse, and edit stop loss or take profit.

6. **Margin stays on the trade workspace.** Equity, margin, and free margin sit on the terminal with the ticket and the positions. There is no second page whose only job is an empty open-trades list.

7. **The chart has its own layout controls.** Candles, bars, line, and area; layouts from a single chart through 3×3; fullscreen; drawings; RSI and MACD. The chart component is not TradingView.

8. **Forex cash is a separate ledger.** Demo and live forex accounts post to forex books, not to the crypto spot wallet.

## What these findings do not cover

ADB Forex order execution is simulated in the current build. The Aynzenix session showed a funding form with bank transfer, UPI, and crypto, plus account groups and menu entries for copy trading, PAMM, MAM, and IB Room. Those areas are outside the differences listed above.

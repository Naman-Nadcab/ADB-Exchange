# FOREX MT5 Final Workstation Status

**Date:** 2026-09-24  
**Branch:** `release/exchange-production-baseline`  
**Runtime:** http://109.123.254.30/forex/trade  
**BUILD_ID:** `rIO3Df0xtVAsNfdxTS97W`  
**Image:** `m-live-frontend@sha256:648bfc453969c1ec0c6c14f74fbe20618d391c6b8cb9f92402f9724e6ba2512b`

| Capability | Status | Notes |
|------------|--------|-------|
| Chart | DONE | MT5 layout intact; 15M/1H/5M switch; live quotes; no ordering assertion observed |
| Drawing | PARTIAL | Core rail tools exposed and engine-backed; full per-tool move/resize/delete matrix not all re-certified in one browser pass this deploy |
| Object Manager | DONE | Lists native + extra; hide/lock/delete wired for both layers after this pass |
| Data Window | DONE | OHLC/spread + indicator slots on deployed runtime |
| Netting | DONE | One net position per symbol; API-driven close/modify |
| Hedging | DONE | Independent rows by `positionId`; chart SL/TP targets explicit row focus when multiple legs |
| Order Types | PARTIAL | Market/Limit/Stop/Stop-Limit + GTC/IOC/FOK when server advertises; DAY/GTD gated on pending |
| SL/TP | DONE | Protections API; chart levels follow selected/net position |
| Partial Close | DONE | Volume API; hedging uses selected position |
| Trailing Stop | PARTIAL | Backend `protections.trailing` exposed; UI on position row; requires signed-in session to runtime-verify ratchet |
| One Click | PARTIAL | Opt-in toolbar + chrome Buy/Sell; uses same order engine; disabled when unsigned |
| Market Watch | DONE | Symbol/bid/ask/spread/high/low/change; chart + order actions |
| Symbol Specification | DONE | Instrument-driven fields (unchanged) |
| DOM | EXTERNAL_DEPENDENCY | No genuine depth feed wired to customer terminal |
| Time & Sales | EXTERNAL_DEPENDENCY | No tick/trade tape feed |
| Alerts | PARTIAL | Local price alert markers + backend alert types; no push/email channel |
| Templates | PARTIAL | Local chart template save (studies/appearance); drawings via separate persistence keys |
| Economic Calendar | PARTIAL | Real API markers + strip; hover/detail on implemented events |

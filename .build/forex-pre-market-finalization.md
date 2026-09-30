# Pre-market finalization

Fresh forensic audit completed **2026-09-19**. All non-market Phase 4/5 work is done; remaining work is **market-only** (see checkpoint JSON).

## Verification run

| Layer | Command / artifact | Result |
|--------|-------------------|--------|
| Live API + WS | `node scripts/forex-pre-market-cert.mjs` | PASS → `.build/forex-pre-market-cert.json` |
| Browser responsive | `node scripts/forex-pre-market-browser.mjs` | PASS → `.build/forex-pre-market-browser.json` |
| Backend unit | phase5–8, 6, 104, 1c, 2-customer, entry-price, ws-auth | PASS |
| Frontend unit | workstation, preview, foundation, phase11, positions, candles | PASS |

## Fixes this pass

- Weekend `SESSION_CLOSED` in **forex-phase1c-stoplimit-tif.test.ts** — test clock (not production).
- **forex-preview.test.ts** — `previewRequestKey` fields.
- New cert scripts for repeatable pre-market API/WS/browser audits.

## Deployment

Digests unchanged; **no redeploy** required (test/script-only delta).

## Crypto / REAL_FOREX

Crypto baseline SHA256 verified. REAL_FOREX unset.

## Market-only

`.build/forex-phase4-market-only-final-checkpoint.json`  
`.build/forex-phase5-market-only-final-checkpoint.json`

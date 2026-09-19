# Forex customer production certification

**FINAL STATUS: GO** — DEMO customer production ready (REAL_FOREX OFF)

Generated: 2026-09-19T16:22:00Z

## Deployment

| Component | Digest |
|-----------|--------|
| Backend | `sha256:003d831f77ce97accdbc3cc2bb6d52df2600428b267f492fc8a4279d714bdc96` |
| Frontend | `sha256:23b996c071ca897d8d856879fcb5894e460f69ea609a8c16dee1353e90add733` |
| Matching engine | unchanged `sha256:35f759ed…` |

## Primary evidence

- **Lifecycle + DB:** `.build/FOREX_POST_DEPLOY_DB_CERTIFICATION.json` — demo fund → market → position → reverse → close → ledger/journal/fills
- **Reverse (extended):** `forex-phase1b-close-by-reverse.cert.ts` — 16/16 PASS on live API
- **REST IDOR:** `.build/forex-live-idor-certification.json`
- **Browser:** `.build/forex-browser-e2e-certification.json`, `.build/forex-account-center-browser-cert.json`
- **WS scope:** `forex-ws-account-scope.test.ts` PASS

## REAL_FOREX

API `realForex: false`, `executionMode: MOCK`, `source: SIMULATED`.

## Demo session policy

When `FOREX_DEMO_FUNDING=true` and REAL_FOREX off, MOCK demo customer orders may proceed during FX weekend closure (practice trading). Live calendar rules apply when demo bypass is not active.

## Remaining limitations

See JSON `knownLimitations` — alerts/a11y partial, no DOM/tape/PDF.

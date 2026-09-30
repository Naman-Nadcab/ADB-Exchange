# Forex market runtime — deferred

**Date:** 2026-09-19 (weekend closure)

Development for Phase 4 and Phase 5 is **complete** for all work that does not require an open Forex session. Live GREEN certification is **explicitly deferred**.

## Resume (deterministic)

```bash
# 1) Confirm session
curl -s http://127.0.0.1:4000/api/v1/forex/sessions | jq '.data.eligibility'

# 2) Phase 4 live matrix (must exit 0 for GREEN)
node scripts/forex-phase4-live-green-cert.mjs

# 3) Phase 5 browser/WS checklist
# See .build/forex-phase5-market-runtime-checkpoint.md
```

Optional waiter: `bash scripts/forex-phase4-wait-and-green-cert.sh`

## Policy

- REAL_FOREX stays OFF
- Crypto untouched
- No session bypass, fake quotes, or DB seeding for cert

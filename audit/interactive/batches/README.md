# Interactive batch audit index

Focused sequential batches (10–15 routes max, one browser, no screenshots).

| Batch | Priority | Routes | Status |
|-------|----------|--------|--------|
| wallet-1 | 1 | 13 | **stopped** at `/wallet/deposit` — [findings](./wallet-1-FINDINGS.md) |
| wallet-2 | 1 | 6 | pending |
| spot-1 | 2 | 7 | pending |
| orders-1 | 3 | 9 | pending |
| p2p-1 | 4 | 14 | pending |
| p2p-2 | 4 | 11 | pending |
| admin-treasury-1 | 5 | 2 | pending |
| admin-mm-1 | 6 | 1 | pending |

## Run commands

```bash
node scripts/interactive-batch-audit.mjs wallet-1   # resume partial batch
node scripts/interactive-batch-audit.mjs --next     # next incomplete batch
node scripts/interactive-batch-audit.mjs --list     # show status
```

Config: `audit/interactive/batches.json`  
Results: `audit/interactive/data/batch-results.json`

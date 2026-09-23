# Customer-visible surface inventory (living document)

**Scope:** `apps/frontend` customer routes and shared chrome.  
**Locales:** en, zh-CN, id-ID.

## Route discovery

| Source | Count |
| --- | --- |
| `page.tsx` under `src/app` | 129 |
| Static routes (e2e inventory) | 113 |
| Dynamic patterns (fixture-blocked) | 15 |
| Wallet re-exports to dashboard | 12+ (see `wallet-route-reexport.test.ts`) |

## Domain coverage status

| Domain | Source audit | Runtime zh-CN/id-ID | Notes |
| --- | --- | --- | --- |
| Wallet convert/history | PASS | PASS (e2e) | User-reported regression fixed |
| Wallet funding/pnl | PASS | pending redeploy | Re-export class |
| Wallet overview/unified/transfer/deposit/withdraw | partial | partial | Overview largely namespaced |
| Public / markets / auth | partial | partial | Prior deep pass |
| P2P (p2p → p2p-v2 re-exports) | partial | partial | |
| Forex terminal strings | partial | partial | No visual redesign |
| Account / earn / orders | partial | partial | orders/history re-exports wallet history |

## Interaction-generated surfaces

Tracked in `.build/I18N_INTERACTION_COVERAGE.md`. Platform-wide crawl **incomplete**.

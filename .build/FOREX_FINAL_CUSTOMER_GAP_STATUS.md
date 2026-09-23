# Forex final customer gap status (source @ a960274)

| Cap | Status |
|-----|--------|
| A User identity | DONE |
| B Demo account creation | DONE |
| C Live account application | DONE (queue; no broker provision) |
| D Multiple account management | DONE |
| E Account ID | DONE |
| F Trading login | DONE (practice login = account id; broker login separate) |
| G Server/group | DONE |
| H Account configuration | PARTIAL (read + position mode when active; no leverage self-service) |
| I Account detail | DONE |
| J Balance/equity/margin | DONE (cardSnapshot + hub) |
| K Risk/account health | DONE |
| L Trading history | DONE |
| M Funding history | DONE |
| N Deposit (live) | BLOCKED_EXTERNAL |
| O Withdrawal (live) | BLOCKED_EXTERNAL |
| P Internal transfer | DONE (demo, ledger) |
| Q Payment methods | BLOCKED_EXTERNAL |
| R Trading password | BLOCKED_EXTERNAL |
| S Investor password | BLOCKED_EXTERNAL |
| T KYC/eligibility | DONE |
| U Account settings | PARTIAL (position mode; alias/leverage request not backend) |
| V Account lifecycle | BLOCKED_EXTERNAL (close/suspend) |
| W Documents/agreements | PARTIAL (links only) |
| X Account closure | BLOCKED_EXTERNAL |

**Identity separation:** platform customer ID (`user_id`) ≠ internal Forex account ID ≠ broker trading login (null until provisioned).

# WORKFLOW COVERAGE

| Workflow | Routes | Automated | Status |
|----------|--------|-----------|--------|
| Signup | /signup | page load | OK |
| Login | /login | page load | OK |
| KYC | /dashboard/identity | auth redirect expected | AUTH |
| Deposit | /wallet/deposit/crypto | page load | OK |
| Withdraw | /wallet/withdraw/crypto | page load | OK |
| Trade | /trade/spot | page load + WS | OK |
| P2P | /p2p | page load | OK |
| Admin halt | /control-center | admin auth | partial |

Full E2E submit flows not executed (read-only forensic pass).

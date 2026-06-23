# Hot Wallet Provisioning

## Supported chain families

From `hot-wallet.service.ts` — one hot wallet per family:

| Family | Representative chain (from DB) | Notes |
|--------|----------------------------------|-------|
| `evm` | First active EVM chain (e.g. `ethereum`) | Shared address for all EVM networks |
| `bitcoin` | `bitcoin` | Native BTC |
| `solana` | `solana` | |
| `tron` | `tron` | |
| `polkadot` | `polkadot` | |

## Provision (idempotent)

```bash
# From repo root (requires DATABASE_URL + ENCRYPTION_KEY in .env)
npm run provision:hot-wallets

# Dry run — list only
DRY_RUN=1 npm run provision:hot-wallets
```

Script: `apps/backend/scripts/provision-hot-wallets.ts`  
Shell: `scripts/provision-hot-wallets.sh`

## Required environment

| Variable | Dev | Production |
|----------|-----|------------|
| `DATABASE_URL` | ✓ | ✓ |
| `ENCRYPTION_KEY` | min 32 chars | min 32 chars |
| `KMS_TYPE` | `local` | `aws` |
| `AWS_KMS_KEY_ID` | — | required |
| `AWS_REGION` | — | required |
| `PROVISION_ACTOR_ADMIN_ID` | optional | super_admin UUID for audit |

## Verify

```bash
# Admin API (authenticated)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:4000/api/v1/admin/hot-wallets | jq '.allFamilies[] | {type, hasWallet}'
```

Expect `hasWallet: true` for each supported family.

## Funding & gas

After provision, fund each hot wallet address with native gas token:

| Family | Fund with | Minimum (operational guidance) |
|--------|-----------|--------------------------------|
| EVM | ETH (or chain native on L2) | Enough for 50+ withdrawals/sweeps |
| Bitcoin | BTC | 0.01+ BTC for fees |
| Solana | SOL | 1+ SOL |
| Tron | TRX | 500+ TRX for energy/bandwidth |
| Polkadot | DOT | 5+ DOT |

Set alerts via admin **Treasury → Hot Wallets** (`min_balance_alert`, `min_hot_balance`).

## Workers required

Deposit sweep, signing, and hot→cold sweep run only when `RUN_MODE=all` (production default in `config/index.ts` and `docker-compose.production.yml`).

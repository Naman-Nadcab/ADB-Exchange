# Frontend Route Consistency Map

This map documents the current Tier-1 canonical URL structure and the legacy aliases still accepted for compatibility.

## Canonical Public Routes

- `/markets`
- `/trade/spot`
- `/orders` (+ `/orders/spot`, `/orders/trades`, `/orders/p2p`)
- `/wallet` (+ `/wallet/deposit/crypto`, `/wallet/withdraw/crypto`, `/wallet/transfer`, `/wallet/history`, `/wallet/pnl`)
- `/p2p` (+ `/p2p/orders`, `/p2p/payment-methods`, `/p2p/profile/:userId`)
- `/earn`
- `/login`, `/signup`, `/forgot-password`, `/terms`, `/privacy`, `/cookies`

## Canonical Dashboard (User Profile/Security/Utility)

- `/dashboard`
- `/dashboard/account`
- `/dashboard/identity`
- `/dashboard/security` (+ nested security routes)
- `/dashboard/preferences`
- `/dashboard/support`
- `/dashboard/events`
- `/dashboard/referral`
- `/dashboard/api`
- `/dashboard/announcements`

## Legacy Prefixes (Still Reachable)

- `/dashboard/assets/*`
- `/dashboard/wallet/*`
- `/dashboard/orders/*`
- `/dashboard/deposit/*`
- `/dashboard/withdraw/*`
- `/dashboard/transfer*`
- `/dashboard/p2p/*`
- `/dashboard/markets*`
- `/dashboard/spot*`
- `/dashboard/trade*`
- `/p2p-v2/*`
- `/spot`

## Redirect Unification Rules

Redirects are enforced in middleware and preserve search params:

- `/dashboard/trade/spot` -> `/trade/spot`
- `/dashboard/trade` -> `/trade/spot`
- `/dashboard/spot` -> `/trade/spot`
- `/spot` -> `/trade/spot`
- `/dashboard/assets/*` -> `/wallet/*`
- `/dashboard/wallet/*` -> `/wallet/*`
- `/dashboard/orders/*` -> `/orders/*`
- `/dashboard/deposit/crypto*` -> `/wallet/deposit/crypto*`
- `/dashboard/withdraw/crypto*` -> `/wallet/withdraw/crypto*`
- `/dashboard/withdraw/fiat*` -> `/wallet/withdraw/fiat*`
- `/dashboard/transfer*` -> `/wallet/transfer*`
- `/dashboard/p2p/*` -> `/p2p/*`
- `/dashboard/markets*` -> `/markets*`
- `/dashboard/earn*` -> `/earn*`
- `/p2p-v2/*` -> `/p2p/*`
- `/p2p-v2/merchant/:id` -> `/p2p/profile/:id`
- `/p2p/merchant/:id` -> `/p2p/profile/:id`

## Known Duplicate Surface (Compatibility Layer)

The following duplicate route families exist by design for migration safety:

- Wallet: `/wallet/*` and legacy `/dashboard/assets/*`, `/dashboard/wallet/*`
- Orders: `/orders/*` and legacy `/dashboard/orders/*`
- P2P: `/p2p/*` and legacy `/p2p-v2/*`, `/dashboard/p2p/*`
- Spot terminal: `/trade/spot` and legacy `/spot`, `/dashboard/spot`, `/dashboard/trade/*`

## Consistency Goal

Navigation and new links should always target canonical paths:

- Trading: `/trade/spot`
- Wallet actions: `/wallet/*`
- Orders and history: `/orders/*`
- P2P: `/p2p/*`

Legacy paths remain temporary compatibility aliases only.

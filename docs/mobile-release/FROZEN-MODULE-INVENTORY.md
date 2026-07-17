# Frozen Module Inventory — METHErium Mobile v1.0.0

**Issued:** 2026-07-17 · **Baseline commit:** `6cd5d02` (+ Phase 7.6 QA infra)

All modules below are **engineering-frozen**. Only UI-layer polish (Phase 8) may change presentation; no business logic, API contracts, or navigation structure changes without a verified production bug.

---

## Feature Modules

| Module | Path | Screens (stack) | Repository | Hooks | Status |
|--------|------|-----------------|------------|-------|--------|
| **App Shell** | `features/app-shell/` | Splash, gates (offline, maintenance, force update, sanctions, restricted, rate limit) | `PublicRepository` | — | FROZEN |
| **Auth** | `features/auth/` | Welcome, login, signup, OTP, forgot password, OAuth, onboarding biometrics | `AuthRepository` | `useAuthActions`, `useGuestAccess`, `useOAuth` | FROZEN |
| **Markets** | `features/markets/` | Home, pair detail, search | `PublicRepository`, `SpotRepository` | `useMarkets`, `useAnnouncements` | FROZEN |
| **Trade** | `features/trade/` | Spot trading, pair selector, fullscreen chart/orderbook/trades | `SpotRepository` | `useSpotTrading`, `useSpotWs` | FROZEN |
| **Orders** | `features/orders/` | Orders home, order history, trade history | `SpotRepository` | `useOrders` | FROZEN |
| **Wallet** | `features/wallet/` | Assets, funding, unified trading, deposit, withdraw, fiat withdraw, transfer, convert, history, PnL, address book | `WalletRepository`, `ConvertRepository` | `useWallet` | FROZEN |
| **P2P** | `features/p2p/` | Marketplace, ads, order room, orders, payment methods, merchant, disputes, chat | `P2PRepository` | `useP2P`, `useOrderRoomActions`, `usePaymentMethodActions` | FROZEN |
| **Account** | `features/account/` | Profile, security, KYC, support, notifications, announcements, data export, referral, API keys | `UserRepository`, `KycRepository`, `SupportRepository`, `PushRepository` | Various account hooks | FROZEN |

---

## Core Layer (Frozen)

| Area | Path | Notes |
|------|------|-------|
| API / HTTP | `core/api/` | Single `httpClient`, auth hooks, error taxonomy |
| Repositories | `core/repositories/` | 10 repository classes; no duplicates |
| WebSocket | `core/ws/` | Single `SpotWsClient` owner via `WsProvider` |
| State | `core/state/` | Zustand: `authStore`, `appStore` |
| Storage | `core/storage/` | MMKV + cache keys (see `cacheKeys.ts`) |
| Auth / Session | `core/auth/` | `sessionManager`, token refresh |
| Guest mode | `core/guest/` | Guest guards, auth intents |
| Security | `core/security/` | App lock, biometrics |
| Offline | `core/offline/` | NetInfo, read cache, reconnect policy |
| Navigation ref | `app/navigation/` | Linking, root ref, types |

---

## Shared UI (UI polish allowed in Phase 8)

| Area | Path |
|------|------|
| Design system | `shared/theme/` |
| Components | `shared/ui/` |
| Brand | `shared/brand/` |

---

## Screen testID Registry (automation)

Tier-1 smoke IDs: `S-100`, `S-103`, `S-200`, `S-201`, `S-300`, `S-500`, `S-600`, `S-700`. Full screen inventory in `MOB-001B-SCREEN-SPECIFICATIONS.md`.

---

## Dev-Only Paths (not in production Release)

| Flag | Purpose | Gated by |
|------|---------|----------|
| `EXPO_PUBLIC_CERT_PREVIEW=1` | Authenticated UI cert without backend | `__DEV__` |
| `EXPO_PUBLIC_AUTH_PREVIEW=1` | Force auth/onboarding screens | `__DEV__` |
| `EXPO_PUBLIC_GUEST_BOOT=1` | Skip to guest main | `__DEV__` |
| `EXPO_PUBLIC_FORCE_SHELL_GATE` | Force shell gate screen | `__DEV__` |

These flags **cannot activate** in production Release builds (`__DEV__ === false`).

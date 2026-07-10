# MOB-001C — Folder Structure (Complete Tree)

**Status:** FROZEN — every path defined before `apps/mobile` scaffold

```
apps/mobile/
├── app.config.ts                 # Expo config, env, deep links
├── app.json                      # Expo manifest
├── eas.json                      # EAS Build profiles
├── babel.config.js
├── metro.config.js               # Monorepo watchFolders
├── tsconfig.json
├── package.json                  # @exchange/mobile
├── index.ts                      # Entry registerRootComponent
├── .env.example
├── README.md
│
├── app/                          # Application shell
│   ├── App.tsx                   # Providers root
│   ├── providers/
│   │   ├── QueryProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── AuthProvider.tsx
│   │   ├── WsProvider.tsx
│   │   ├── ObservabilityProvider.tsx
│   │   └── GestureProvider.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── OnboardingNavigator.tsx
│   │   ├── MainTabNavigator.tsx
│   │   ├── linking.ts            # Deep + universal links
│   │   ├── guards.ts             # Auth, KYC, halt guards
│   │   └── types.ts              # ParamList types
│   └── bootstrap/
│       ├── initStorage.ts
│       ├── initObservability.ts
│       └── versionGate.ts        # S-001 force update
│
├── features/
│   ├── app-shell/
│   │   ├── screens/              # S-000..007, maintenance, offline
│   │   ├── components/           # GlobalSearch, QuickActions, banners
│   │   ├── hooks/
│   │   └── index.ts
│   ├── auth/
│   │   ├── screens/              # S-100..115
│   │   ├── components/           # OTPInput, PasskeyButton, OAuth
│   │   ├── hooks/                # useLogin, useSignup, useOAuth
│   │   ├── viewmodels/
│   │   └── index.ts
│   ├── onboarding/
│   │   ├── screens/              # W-200, S-120..123
│   │   └── index.ts
│   ├── markets/
│   │   ├── screens/              # S-200..202
│   │   ├── components/           # MarketRow, Sparkline
│   │   ├── hooks/                # useMarkets, useFavorites
│   │   └── index.ts
│   ├── trade/
│   │   ├── screens/              # S-300..304
│   │   ├── components/           # OrderBook, Chart, OrderForm
│   │   ├── hooks/                # useSpotOrder, useOrderbook
│   │   ├── viewmodels/
│   │   └── index.ts
│   ├── orders/
│   │   ├── screens/              # S-400..404
│   │   ├── components/
│   │   └── index.ts
│   ├── wallet/
│   │   ├── screens/              # S-500..551, W-510
│   │   ├── components/           # QRCard, WithdrawForm, Convert
│   │   ├── hooks/
│   │   └── index.ts
│   ├── p2p/
│   │   ├── screens/              # S-600..616
│   │   ├── components/           # Chat, Timeline, AdCard
│   │   ├── hooks/
│   │   └── index.ts
│   └── account/
│       ├── screens/              # S-700..792, S-124
│       ├── subfeatures/
│       │   ├── security/         # S-710..719
│       │   ├── kyc/              # S-730..735
│       │   ├── referral/         # S-742..744
│       │   ├── support/          # S-760..764
│       │   ├── notifications/    # S-770..773
│       │   └── api-keys/         # S-750..752
│       └── index.ts
│
├── shared/
│   ├── ui/                       # MOB-001B components (presentational)
│   │   ├── buttons/
│   │   ├── inputs/
│   │   ├── feedback/             # Toast, Dialog, BottomSheet, Skeleton
│   │   ├── layout/               # AppHeader, TabBar, EmptyState
│   │   └── index.ts
│   ├── theme/
│   │   ├── tokens.ts             # From MOB-001B-DESIGN-SYSTEM
│   │   ├── typography.ts
│   │   ├── colors.ts
│   │   └── useTheme.ts
│   ├── forms/
│   ├── navigation/
│   └── utils/
│
├── core/
│   ├── api/
│   │   ├── httpClient.ts
│   │   ├── interceptors/
│   │   │   ├── authInterceptor.ts
│   │   │   ├── idempotencyInterceptor.ts
│   │   │   ├── rateLimitInterceptor.ts
│   │   │   └── errorInterceptor.ts
│   │   ├── errors/
│   │   │   ├── ApiError.ts
│   │   │   └── errorCodes.ts     # Maps backend codes
│   │   └── types/
│   ├── repositories/             # One file per repository
│   ├── domain/                   # Pure business rules
│   ├── ws/
│   │   ├── SpotWsClient.ts
│   │   ├── channels.ts
│   │   ├── messageHandlers.ts
│   │   └── reconnectPolicy.ts
│   ├── storage/
│   │   ├── secureStorage.ts
│   │   ├── mmkvStorage.ts
│   │   └── cacheKeys.ts
│   ├── security/
│   │   ├── appLock.ts
│   │   ├── certificatePinning.ts
│   │   ├── deviceIntegrity.ts
│   │   └── clipboardPolicy.ts
│   ├── offline/
│   │   ├── netInfo.ts
│   │   ├── readCache.ts
│   │   └── cacheTTL.ts
│   ├── observability/
│   │   ├── logger.ts
│   │   ├── analytics.ts
│   │   ├── crashReporting.ts
│   │   └── performance.ts
│   └── events/
│       └── appEventBus.ts
│
├── assets/
│   ├── images/
│   ├── icons/
│   ├── fonts/                    # System fonts only MVP
│   └── lottie/                   # Optional loading animations
│
├── tests/
│   ├── unit/                     # Mirror core/ and features/
│   ├── integration/
│   ├── component/
│   └── __fixtures__/
│       ├── api/
│       └── ws/
│
├── e2e/                          # Maestro flows
│   ├── auth/
│   ├── trade/
│   ├── wallet/
│   └── p2p/
│
└── docs/                         # Mobile-specific dev notes
    └── ONBOARDING-DEV.md

packages/mobile-types/
├── package.json                  # @exchange/mobile-types
├── src/
│   ├── auth.ts
│   ├── spot.ts
│   ├── wallet.ts
│   ├── p2p.ts
│   └── index.ts
└── tsconfig.json
```

## Configuration Files (defined)

| File | Purpose |
|------|---------|
| `app.config.ts` | Bundle ID, scheme `metheorium`, associated domains |
| `eas.json` | development, qa, uat, production profiles |
| `.eslintrc.js` | Extends monorepo; import boundary rules |
| `jest.config.js` | Unit + component |
| `maestro.config` | E2E workspace |

## Test Location Rules

| Test type | Location |
|-----------|----------|
| Unit (domain, utils) | `tests/unit/core/**` |
| Repository integration | `tests/integration/repositories/**` |
| Component | `tests/component/shared/**` |
| Feature hook | `features/*/hooks/__tests__` |
| E2E | `e2e/<flow>/*.yaml` |
| Golden screenshots | `tests/golden/<screenId>/` |
| a11y | `tests/a11y/*.test.tsx` |

## Asset Rules

- Icons: SF Symbols mapping (iOS) + Material (Android) via unified icon set
- Coin logos: CDN URL from backend token metadata — cached `expo-image`
- No bundled coin PNGs except fallback

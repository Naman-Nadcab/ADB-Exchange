# METHErium Mobile

Sprint 0 foundation — see `docs/mobile-product-architecture/MOB-001C-*`.

## Commands

```bash
cd apps/mobile
npm install
npm run typecheck
npm run test
npm run validate:architecture
npx expo start --dev-client
```

## Architecture

- `app/` — shell, providers, navigation
- `features/` — feature modules (placeholders Sprint 0)
- `core/` — api, ws, storage, security
- `shared/` — theme, ui

Backend baseline: `00988649da52031923e2d62bf4f9c2fdc384f479` (unchanged).

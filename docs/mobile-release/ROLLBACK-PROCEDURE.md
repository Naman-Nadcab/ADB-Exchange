# Rollback Procedure — METHErium Mobile

---

## Git rollback (engineering baseline)

**Frozen baseline tag (recommended):** `phase-7.6-engineering-freeze`  
**Last known good commit:** `6cd5d02` (Phase 7.4 Maestro fixes) + Phase 7.6 QA infra

### Revert to engineering freeze

```bash
git fetch origin
git checkout phase-7.6-engineering-freeze
# or
git checkout 6cd5d02
```

### Revert a bad Phase 8 UI commit

```bash
git revert <commit-sha>
# Prefer revert over reset if changes were pushed
```

---

## Release build rollback (App Store / Play Store)

1. **Do not delete** the previous approved binary in App Store Connect / Play Console.
2. Submit a **new build** from the frozen engineering baseline if UI regression is severe.
3. For critical production bug: hotfix branch from `phase-7.6-engineering-freeze`, fix verified bug only, fast-track review.

---

## Configuration rollback

| Variable | Production default | Rollback action |
|----------|-------------------|-----------------|
| `APP_ENV` | `production` | Set to `production`; never ship with `development` |
| `EXPO_PUBLIC_API_URL` | `https://api.metheorium.com` | Restore in EAS secrets / CI |
| `EXPO_PUBLIC_CERT_PREVIEW` | `0` | Must remain off in Release |
| `EXPO_PUBLIC_AUTH_PREVIEW` | `0` | Must remain off in Release |

---

## QA infrastructure rollback

If Maestro changes cause false failures:

```bash
git checkout 6cd5d02 -- apps/mobile/e2e/
git checkout 6cd5d02 -- apps/mobile/maestro.config
```

Phase 7.6 QA scripts are additive under `scripts/qa/` — safe to keep even when rolling back YAML.

---

## Backend compatibility

Mobile v1.0.0 targets backend baseline documented in MOB-001C. If backend breaking change occurs:

1. **Do not** patch mobile business logic in Phase 8.
2. Open hotfix branch from engineering freeze.
3. Coordinate API version with backend team.

---

## Verification after rollback

```bash
cd apps/mobile
npm run typecheck
npm test
npm run lint
npm run validate:architecture
npm run qa:matrix:ios   # requires Release build
```

All gates must pass before re-release.

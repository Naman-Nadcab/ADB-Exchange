# MOB-001C — CI/CD & Build/Release Architecture

**Status:** FROZEN

---

## 1. Environments

| Env | Branch | API | Distribution |
|-----|--------|-----|--------------|
| development | feature/* | local/LAN | Expo Dev Client |
| qa | `develop` | qa-api | Internal TestFlight / Firebase App Distribution |
| uat | `release/*` | uat-api | UAT testers |
| production | `main` + tag | prod-api | App Store + Play Store |

---

## 2. Build System

- **EAS Build** (Expo Application Services)
- Profiles in `eas.json`: `development`, `qa`, `uat`, `production`
- iOS: Xcode 16+, Android: API 35 target, min API 26 (Android 8)
- iOS min: 15.0 | Android min: 26 per ADR

---

## 3. Versioning

| Component | Scheme |
|-----------|--------|
| semver | `MAJOR.MINOR.PATCH` user-facing |
| iOS buildNumber | monotonic integer |
| Android versionCode | monotonic integer |
| OTA runtime | `runtimeVersion` policy `appVersion` |

---

## 4. Signing

| Platform | Method |
|----------|--------|
| iOS | Apple Distribution via EAS credentials |
| Android | Play App Signing upload key via EAS |

No manual keystore on developer laptops.

---

## 5. OTA Strategy

| Channel | Tool | Scope |
|---------|------|-------|
| JS-only fixes | EAS Update | qa, uat |
| Production OTA | EAS Update | **disabled MVP** — store releases only |
| Native changes | Store rebuild required |

**Rollback:** EAS Update rollback to previous branch update.

---

## 6. CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/mobile.yml (to be created at scaffold)
on: [pull_request, push to develop/main]

jobs:
  validate:
    - checkout
    - setup node 20
    - npm ci (root monorepo)
    - turbo run lint typecheck test --filter=@exchange/mobile
    - jest --coverage threshold 70% core/
  security:
    - npm audit --audit-level=high
    - secret scan (gitleaks)
  e2e (nightly):
    - maestro test e2e/smoke.yaml on simulator
  build (on tag mobile-v*):
    - eas build --platform all --profile production --non-interactive
```

---

## 7. Quality Gates

| Gate | Threshold | Block merge |
|------|-----------|-------------|
| ESLint | 0 errors | yes |
| TypeScript | 0 errors | yes |
| Unit tests | pass | yes |
| Coverage core/ | ≥70% | yes |
| Maestro smoke | pass | nightly block release |
| Bundle size | <12 MB | warn |
| Sentry source maps | uploaded | release |

---

## 8. Store Deployment

1. Tag `mobile-v1.0.0`
2. EAS production build
3. Submit `eas submit` iOS + Android
4. Phased rollout: 10% → 50% → 100% (Play); TestFlight → App Store review

---

## 9. Rollback

| Type | Action |
|------|--------|
| Bad JS OTA | EAS rollback |
| Bad native | Store expedited review + prior build promote |
| Backend incompatibility | Min version force S-001 |

---

## 10. Artifacts

| Artifact | Retention |
|----------|-----------|
| IPA/AAB | 1 year S3/EAS |
| Source maps | 90 days |
| Test reports | 30 days CI |
| Screenshots store | per release git tag |

---

## 11. Release Channels

- iOS: TestFlight internal → external → App Store
- Android: internal → closed → open testing → production

---

## 12. Dependency Audit in CI

`npm audit` + `license-checker` allowlist MIT/Apache/BSD only for production deps.

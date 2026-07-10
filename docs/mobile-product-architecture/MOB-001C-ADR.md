# MOB-001C — Architecture Decision Records (ADR)

**Status:** FROZEN

---

## ADR-001: React Native

**Status:** Accepted

**Context:** Need iOS + Android from one team; backend frozen; web uses React.

**Decision:** React Native 0.76+.

**Rationale:** Shared mental model with `apps/frontend`; large ecosystem; tier-1 exchanges use RN or native hybrid.

**Consequences:** Native modules via Expo config plugins; bridge perf acceptable with Hermes.

---

## ADR-002: Expo SDK 52 + Development Client

**Status:** Accepted

**Context:** Need OTA, EAS, passkeys, biometrics, secure store without full bare workflow.

**Decision:** Expo managed workflow with **custom dev client** (not Expo Go for prod features).

**Rationale:** Faster CI/CD; EAS Build; config plugins for pinning/passkeys.

**Alternatives rejected:** Bare RN (slower bootstrap); Flutter (no code reuse).

---

## ADR-003: React Navigation 7

**Status:** Accepted

**Decision:** `@react-navigation/native` stack + bottom tabs.

**Rationale:** Matches MOB-001B navigation map; deep linking built-in; industry default.

---

## ADR-004: TanStack Query v5

**Status:** Accepted

**Decision:** Server state exclusively via React Query.

**Rationale:** Caching, retry, infinite scroll, focus refetch — reduces custom cache code.

---

## ADR-005: Zustand v5

**Status:** Accepted

**Decision:** Client global state via Zustand slices.

**Rationale:** Minimal API; no boilerplate; complements Query without overlap.

**Rejected:** Redux Toolkit (heavy); Jotai (less RN examples).

---

## ADR-006: React Hook Form + Zod

**Status:** Accepted

**Decision:** All forms use RHF + Zod schemas from `mobile-types`.

**Rationale:** Performance on mobile; shared validation DTOs.

---

## ADR-007: MMKV Fast Storage

**Status:** Accepted

**Decision:** `react-native-mmkv` for preferences, favorites, cache backup.

**Rationale:** 10× faster than AsyncStorage; sync API simplifies hydration.

---

## ADR-008: Expo Secure Store for Tokens

**Status:** Accepted

**Decision:** Access/refresh tokens only in SecureStore.

**Rationale:** Keychain/Keystore hardware-backed; compliance baseline.

---

## ADR-009: Custom Spot WS Client

**Status:** Accepted

**Decision:** Single `SpotWsClient` class, not Socket.io (backend is raw WS JSON).

**Rationale:** Matches `apps/backend` `/spot/ws` protocol exactly; ticket auth 15s.

---

## ADR-010: Skia/Wagmi Charts

**Status:** Accepted (pick one at scaffold)

**Decision:** Evaluate `@shopify/react-native-skia` first; fallback `react-native-wagmi-charts`.

**Rationale:** 60fps target; avoid WebView charts.

---

## ADR-011: English-only MVP i18n

**Status:** Accepted

**Decision:** i18next wired; `en` only strings.

**Rationale:** Phase 1A scope; structure ready for Hindi v1.2.

---

## ADR-012: Jest + RNTL + Maestro

**Status:** Accepted

**Decision:** Unit/component Jest; E2E Maestro YAML.

**Rationale:** Maestro stable for RN; no Detox flake on CI.

---

## ADR-013: Repository Pattern

**Status:** Accepted

**Decision:** All HTTP via Repository classes in `core/repositories/`.

**Rationale:** Testability; single place for endpoint changes; mirrors backend domains.

---

## ADR-014: No Offline Write Queue MVP

**Status:** Accepted

**Decision:** Block writes offline per MOB-001B.

**Rationale:** Avoid financial conflict resolution complexity at launch.

---

## ADR-015: Pro-Only UI (No Lite Mode)

**Status:** Accepted

**Decision:** Single dense trading UI.

**Rationale:** MOB-001B freeze assumption A1; reduces implementation surface.

---

## ADR-016: Feature-First Folder Structure

**Status:** Accepted

**Decision:** `features/<domain>/` not layer-first.

**Rationale:** Ownership clarity; scales teams; screen ID maps 1:1.

---

## ADR-017: Certificate Pinning Production Only

**Status:** Accepted

**Decision:** Pin prod/uat certs; dev off.

**Rationale:** Dev flexibility; prod MITM protection.

---

## ADR-018: Sentry for Crashes

**Status:** Accepted

**Decision:** Sentry RN SDK.

**Rationale:** Monorepo may already use Sentry ops patterns; source map support.

---

## ADR-019: Monorepo apps/mobile

**Status:** Accepted

**Decision:** Add `apps/mobile` to existing turbo monorepo.

**Rationale:** Align with backend freeze SHA; shared types package; unified CI.

---

## ADR-020: No New Backend APIs MVP

**Status:** Accepted

**Decision:** Consume frozen `/api/v1`; push native token extension optional spike only.

**Rationale:** Backend baseline immutable per operator directive.

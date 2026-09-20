# ADMIN SHELL / DOMAIN SEPARATION CERTIFICATION

| Field | Value |
|-------|--------|
| Branch | `release/exchange-production-baseline` |
| Base SHA | `a4d922ee1b30f3bbb0aadebfbc7ac2027bc82623` |
| Build | **PASS** (`apps/admin-panel` production build) |
| Browser E2E | **NOT_VERIFIED** (Playwright chromium missing; admin container not redeployed) |
| Database mutations | **NOT_APPLICABLE** |
| Deployment | **NOT_VERIFIED** |

## Implementation summary

1. **Login → Control Center** — `apps/admin-panel/src/app/login/page.tsx`
2. **Top tabs** — `AdminDomainContextBar.tsx` (Control Center | Crypto | Forex)
3. **Domain sidebar** — `buildSidebarSectionsForDomain()` in `nav-sections.ts`
4. **UI route guard** — `AdminDomainRouteGuard.tsx` + `admin-domain.ts`
5. **Breadcrumbs** — domain-aware `pageMeta.ts`

## Files changed (intentional)

- `apps/admin-panel/src/lib/admin/admin-domain.ts`
- `apps/admin-panel/src/lib/admin/nav-sections.ts`
- `apps/admin-panel/src/lib/pageMeta.ts`
- `apps/admin-panel/src/components/shell/AdminDomainContextBar.tsx`
- `apps/admin-panel/src/components/shell/AdminDomainRouteGuard.tsx`
- `apps/admin-panel/src/components/shell/AppShell.tsx`
- `apps/admin-panel/src/components/shell/UnifiedSidebar.tsx`
- `apps/admin-panel/src/app/login/page.tsx`
- `scripts/admin-shell-domain-cert.mjs`

## Explicitly NOT changed

- `apps/backend/src/routes/spot.fastify.ts`
- Matching engine, wallet/ledger services, Forex customer UI
- Backend RBAC routes (unchanged)

## Status matrix

| Item | Status |
|------|--------|
| Control Center landing | **PASS** (code) |
| Crypto mode | **PASS** (code) |
| Forex mode | **PASS** (code) |
| Shared under Control Center nav | **PASS** (code) |
| RBAC backend | **NOT_MODIFIED** |
| Direct-route authorization UI | **PARTIAL** (client guard; full role matrix not browser-tested) |
| Emergency control scoping | **NOT_MODIFIED** (existing pages; labels unchanged) |
| Responsive shell | **PARTIAL** (tab wrap; not device-tested) |
| A11y shell tabs | **PARTIAL** (roles/aria-selected; not audited) |

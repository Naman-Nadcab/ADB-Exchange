/**
 * Phase 2 extraction boundary (documentation — not executed in Phase 1.1).
 * AUTH + COMMON + ERRORS + NAVIGATION; English canonical first.
 */

export const PHASE2_COMMON_SURFACES = [
  'apps/frontend/src/components/layout/ExchangeHeader.tsx',
  'apps/frontend/src/components/layout/PublicHeader.tsx',
  'apps/frontend/src/components/ui/button.tsx',
  'apps/frontend/src/components/ui/toaster.tsx',
  'apps/frontend/src/lib/notifyError.ts',
] as const;

export const PHASE2_AUTH_SURFACES = [
  'apps/frontend/src/app/(auth)/login',
  'apps/frontend/src/app/(auth)/signup',
  'apps/frontend/src/app/(auth)/forgot-password',
  'apps/frontend/src/app/(auth)/reset-password',
  'apps/frontend/src/components/auth',
] as const;

export const PHASE2_ERROR_SURFACES = [
  'apps/frontend/src/lib/forex/models/errors.ts',
  'apps/frontend/src/lib/notifyError.ts',
  'apps/frontend/src/i18n/errors/error-catalog.ts',
] as const;

export const PHASE2_KEY_CONVENTIONS = {
  commonActions: 'common.actions.{verb}',
  authScreen: 'auth.{screen}.{element}',
  domainError: '{domain}.errors.{code}',
} as const;

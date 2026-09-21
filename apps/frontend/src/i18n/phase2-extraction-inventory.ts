/**
 * Phase 2 extraction boundary — COMMON + AUTH + ERRORS (implemented).
 * Phase 3+ domains remain deferred.
 */

export const PHASE2_COMMON_SURFACES = [
  'apps/frontend/src/components/layout/ExchangeHeader.tsx',
  'apps/frontend/src/components/layout/PublicHeader.tsx',
  'apps/frontend/src/components/providers.tsx',
  'apps/frontend/src/lib/notifyError.ts',
  'apps/frontend/src/hooks/useLocalizedNotify.ts',
] as const;

export const PHASE2_AUTH_SURFACES = [
  'apps/frontend/src/app/(auth)/login/page.tsx',
  'apps/frontend/src/app/(auth)/signup/page.tsx',
  'apps/frontend/src/app/(auth)/forgot-password/page.tsx',
  'apps/frontend/src/components/auth/AuthSplitLayout.tsx',
] as const;

export const PHASE2_ERROR_SURFACES = [
  'apps/frontend/src/i18n/errors/error-catalog.ts',
  'apps/frontend/src/lib/i18n/localize-api-error.ts',
  'apps/frontend/src/hooks/useApiErrorMessage.ts',
] as const;

export const PHASE2_DEFERRED = [
  'Crypto trading domain UI',
  'Forex terminal domain UI',
  'P2P domain UI',
  'Wallet domain UI',
  'Admin panel',
  'Email/SMS/push templates',
  'Legal/compliance long-form pages',
] as const;

export const PHASE2_KEY_CONVENTIONS = {
  commonActions: 'common.actions.{verb}',
  authScreen: 'auth.{screen}.{element}',
  domainError: 'errors.{domain}.{code}',
} as const;

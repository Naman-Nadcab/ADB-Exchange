/**
 * Admin workspace domains — Control Center, Crypto, Forex.
 * UI routing + permission gates (backend remains authoritative).
 */
import { hasAnyPermission, hasPermission, isSuperAdmin, type Permission } from '@/lib/rbac';

export type AdminDomain = 'control' | 'crypto' | 'forex';

export const ADMIN_DOMAIN_LABELS: Record<AdminDomain, string> = {
  control: 'Control Center',
  crypto: 'Crypto',
  forex: 'Forex',
};

export const ADMIN_DOMAIN_LANDING: Record<AdminDomain, string> = {
  control: '/control-center',
  crypto: '/dashboard',
  forex: '/forex',
};

const CRYPTO_PREFIXES = [
  '/trading',
  '/markets',
  '/orders',
  '/trades',
  '/liquidity',
  '/admin/mm-control',
  '/p2p',
  '/wallets',
  '/treasury',
  '/deposits',
  '/withdrawals',
  '/fiat-withdrawals',
  '/reconciliation',
  '/fees',
  '/staking',
  '/dashboard',
];

const CRYPTO_ACCESS: Permission[] = [
  'monitoring:view',
  'monitoring:control',
  'markets:manage',
  'deposits:view',
  'deposits:credit',
  'withdrawals:view',
  'withdrawals:approve',
  'p2p:disputes',
  'p2p:escrow',
  'mm:view',
  'mm:control',
  'treasury:view',
  'treasury:sweep',
  'analytics:view',
  'control:trading',
];

const FOREX_ACCESS: Permission[] = [
  'forex:view',
  'forex:control',
  'forex:controls:view',
  'forex:controls:manage',
  'forex:crm:view',
  'forex:crm:manage',
  'forex:accounts:view',
  'forex:orders:view',
  'forex:positions:view',
  'forex:dealing:view',
  'forex:risk:view',
  'forex:finance:view',
  'forex:compliance:view',
  'forex:integrations:view',
  'forex:audit:view',
];

export function pathnameToAdminDomain(pathname: string): AdminDomain {
  const path = pathname.split('?')[0] ?? '';
  if (path.startsWith('/forex')) return 'forex';
  if (CRYPTO_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return 'crypto';
  return 'control';
}

export function canAccessAdminDomain(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
  domain: AdminDomain,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (domain === 'control') return true;
  if (domain === 'crypto') return hasAnyPermission(role, explicitPermissions, CRYPTO_ACCESS);
  return hasAnyPermission(role, explicitPermissions, FOREX_ACCESS);
}

export function canAccessAdminPath(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
  pathname: string,
): boolean {
  if (isSuperAdmin(role)) return true;
  const domain = pathnameToAdminDomain(pathname);
  return canAccessAdminDomain(role, explicitPermissions, domain);
}

/** First landing page the admin may use after login or when denied a route. */
export function defaultLandingForAdmin(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
): string {
  if (canAccessAdminDomain(role, explicitPermissions, 'control')) return ADMIN_DOMAIN_LANDING.control;
  if (canAccessAdminDomain(role, explicitPermissions, 'crypto')) return ADMIN_DOMAIN_LANDING.crypto;
  if (canAccessAdminDomain(role, explicitPermissions, 'forex')) return ADMIN_DOMAIN_LANDING.forex;
  return ADMIN_DOMAIN_LANDING.control;
}

export function visibleAdminDomains(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
): AdminDomain[] {
  const all: AdminDomain[] = ['control', 'crypto', 'forex'];
  return all.filter((d) => canAccessAdminDomain(role, explicitPermissions, d));
}

/** Context subtitle for page chrome */
export function adminDomainContextTitle(domain: AdminDomain): string {
  switch (domain) {
    case 'control':
      return 'Control Center';
    case 'crypto':
      return 'Crypto Operations';
    case 'forex':
      return 'Forex Operations';
  }
}

export function hasForexPermission(role: string | undefined, explicitPermissions: string[] | undefined): boolean {
  if (isSuperAdmin(role)) return true;
  const perms = explicitPermissions ?? [];
  if (perms.some((p) => p.startsWith('forex:'))) return true;
  return hasPermission(role, explicitPermissions, 'forex:view');
}

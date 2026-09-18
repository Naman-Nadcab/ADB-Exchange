/**
 * Canonical Forex Admin RBAC permissions (control plane).
 * Legacy aliases (forex:control, control:trading) map here — never bypass checks.
 */
import {
  ADMIN_LEGACY_ROLE_PERMISSION,
  ADMIN_IMPLICIT_ROLE_PERMISSIONS,
  hasAdminRbacPermission as baseHasAdminRbacPermission,
} from './admin-rbac-routes.js';

export const FOREX_ADMIN_PERMISSIONS = [
  'forex:view',
  'forex:accounts:view',
  'forex:accounts:manage',
  'forex:crm:view',
  'forex:crm:manage',
  'forex:dealing:view',
  'forex:dealing:manage',
  'forex:orders:view',
  'forex:orders:manage',
  'forex:positions:view',
  'forex:risk:view',
  'forex:risk:manage',
  'forex:liquidity:view',
  'forex:liquidity:manage',
  'forex:finance:view',
  'forex:finance:manage',
  'forex:compliance:view',
  'forex:compliance:manage',
  'forex:integrations:view',
  'forex:integrations:manage',
  'forex:controls:view',
  'forex:controls:manage',
  'forex:audit:view',
] as const;

export type ForexAdminPermission = (typeof FOREX_ADMIN_PERMISSIONS)[number];

/** Legacy permission names that grant canonical forex:controls:manage. */
export const FOREX_CONTROLS_MANAGE_LEGACY = ['forex:controls:manage', 'forex:control', 'control:trading', 'all'] as const;

/** Broad read bundle — roles with forex:view may access all forex *:view scopes. */
const FOREX_VIEW_SUFFIX = ':view' as const;

function roleHasAny(role: string, permissions: readonly string[]): boolean {
  return permissions.some((p) => baseHasAdminRbacPermission(role, p));
}

/**
 * Resolve Forex admin permission (canonical + legacy + bundled view/manage).
 */
export function hasForexAdminPermission(role: string, required: ForexAdminPermission): boolean {
  if (baseHasAdminRbacPermission(role, 'all')) return true;
  if (baseHasAdminRbacPermission(role, required)) return true;

  if (required.endsWith(FOREX_VIEW_SUFFIX) && required !== 'forex:view') {
    if (baseHasAdminRbacPermission(role, 'forex:view')) return true;
  }

  if (required.endsWith(':manage')) {
    if (required === 'forex:controls:manage' || required === 'forex:liquidity:manage' || required === 'forex:risk:manage') {
      if (roleHasAny(role, FOREX_CONTROLS_MANAGE_LEGACY)) return true;
    }
    if (required === 'forex:crm:manage' && baseHasAdminRbacPermission(role, 'users:edit')) {
      return true;
    }
    if (required === 'forex:finance:manage' && baseHasAdminRbacPermission(role, 'deposits:credit')) {
      return true;
    }
    if (required === 'forex:compliance:manage' && baseHasAdminRbacPermission(role, 'aml:escalate')) {
      return true;
    }
  }

  return false;
}

/** Map admin API forex write routes to canonical manage permission. */
export function forexAdminWritePermissionForPath(relativePath: string): ForexAdminPermission {
  if (/\/account-groups/.test(relativePath) || /\/accounts\/[^/]+\/(group|leverage-override)/.test(relativePath)) {
    return 'forex:accounts:manage';
  }
  if (/\/crm\/(leads|notes|tags|tasks)/.test(relativePath)) return 'forex:crm:manage';
  if (relativePath.includes('/crm/')) return 'forex:crm:view';
  if (relativePath.includes('/execution') || relativePath.includes('/routing')) return 'forex:liquidity:manage';
  if (relativePath.includes('/policy') || relativePath.includes('/controls') || relativePath.includes('/instruments')) {
    return 'forex:controls:manage';
  }
  if (relativePath.includes('/orders') && relativePath.includes('force-cancel')) return 'forex:orders:manage';
  return 'forex:controls:manage';
}

export function listForexPermissionsForRole(role: string): ForexAdminPermission[] {
  return FOREX_ADMIN_PERMISSIONS.filter((p) => hasForexAdminPermission(role, p));
}

/** Re-export for tests — implicit matrix must stay aligned with admin-rbac-routes. */
export { ADMIN_IMPLICIT_ROLE_PERMISSIONS, ADMIN_LEGACY_ROLE_PERMISSION };

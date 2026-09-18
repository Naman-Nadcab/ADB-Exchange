/**
 * Role-Based Access Control (RBAC) — frontend enforcement layer.
 *
 * Roles map to permissions. The backend is the source of truth — this layer
 * is for UI gating (hide/disable actions the admin cannot perform).
 */

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  RISK_MANAGER: 'risk_manager',
  FINANCE_ADMIN: 'finance_admin',
  FINANCE_OPS: 'finance_ops',
  SUPPORT_AGENT: 'support_agent',
  COMPLIANCE: 'compliance',
  AUDITOR: 'auditor',
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export type Permission =
  | 'all'
  | 'withdrawals:approve'
  | 'withdrawals:view'
  | 'kyc:review'
  | 'deposits:credit'
  | 'deposits:view'
  | 'users:view'
  | 'users:edit'
  | 'p2p:disputes'
  | 'p2p:escrow'
  | 'aml:view'
  | 'aml:escalate'
  | 'monitoring:view'
  | 'monitoring:control'
  | 'settings:edit'
  | 'settings:view'
  | 'control:commands'
  | 'control:trading'
  | 'forex:view'
  | 'forex:control'
  | 'forex:controls:manage'
  | 'forex:crm:view'
  | 'forex:crm:manage'
  | 'forex:accounts:view'
  | 'forex:accounts:manage'
  | 'forex:orders:view'
  | 'forex:positions:view'
  | 'forex:compliance:view'
  | 'forex:compliance:manage'
  | 'forex:finance:view'
  | 'forex:finance:manage'
  | 'forex:liquidity:view'
  | 'forex:liquidity:manage'
  | 'forex:risk:view'
  | 'forex:risk:manage'
  | 'forex:orders:manage'
  | 'forex:dealing:view'
  | 'forex:dealing:manage'
  | 'forex:integrations:view'
  | 'forex:integrations:manage'
  | 'forex:controls:view'
  | 'forex:audit:view'
  | 'markets:manage'
  | 'treasury:sweep'
  | 'treasury:view'
  | 'mm:control'
  | 'mm:view'
  | 'risk:export'
  | 'audit:view'
  | 'analytics:view';

const ROLE_ALIASES: Record<string, string> = {
  support_agent: 'support',
  finance_admin: 'finance_ops',
  compliance_officer: 'compliance',
};

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ['all'],
  risk_manager: [
    'monitoring:view',
    'monitoring:control',
    'aml:view',
    'aml:escalate',
    'users:view',
    'users:edit',
    'control:trading',
    'forex:view',
    'forex:control',
    'forex:controls:manage',
    'forex:crm:view',
    'forex:crm:manage',
    'forex:accounts:view',
    'forex:accounts:manage',
    'forex:liquidity:manage',
    'forex:risk:manage',
    'forex:orders:manage',
    'forex:orders:view',
    'forex:positions:view',
    'forex:dealing:view',
    'forex:audit:view',
    'markets:manage',
    'risk:export',
    'analytics:view',
    'audit:view',
    'mm:view',
    'treasury:view',
  ],
  finance_ops: [
    'withdrawals:approve',
    'withdrawals:view',
    'deposits:credit',
    'deposits:view',
    'users:view',
    'monitoring:view',
    'markets:manage',
    'treasury:sweep',
    'treasury:view',
    'analytics:view',
    'audit:view',
    'forex:view',
    'forex:finance:view',
  ],
  support: ['users:view', 'users:edit', 'deposits:view', 'withdrawals:view', 'p2p:disputes', 'p2p:escrow', 'monitoring:view'],
  compliance: [
    'kyc:review',
    'aml:view',
    'aml:escalate',
    'audit:view',
    'monitoring:view',
    'users:view',
    'settings:edit',
    'forex:view',
    'forex:crm:view',
    'forex:compliance:view',
  ],
  auditor: [
    'audit:view',
    'monitoring:view',
    'analytics:view',
    'users:view',
    'withdrawals:view',
    'deposits:view',
    'settings:view',
    'risk:export',
    'forex:view',
    'mm:view',
    'treasury:view',
  ],
  withdrawal_approver: ['withdrawals:approve'],
  kyc_reviewer: ['kyc:review'],
  aml_reviewer: ['aml:view'],
};

const SUPER_ROLES = new Set(['super_admin', 'super admin']);

function normalizeRole(role: string | undefined): string {
  const normalized = (role ?? '').toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[normalized] ?? normalized;
}

/**
 * Resolve effective permissions for an admin. Combines role-based and explicit permissions.
 */
export function getEffectivePermissions(role: string | undefined, explicitPermissions: string[] | undefined): Permission[] {
  const normalizedRole = normalizeRole(role);
  if (SUPER_ROLES.has(normalizedRole)) return ['all'];

  const rolePerms = ROLE_PERMISSIONS[normalizedRole] ?? [];
  const explicit = Array.isArray(explicitPermissions) ? explicitPermissions : [];
  const set = new Set<Permission>([...rolePerms, ...(explicit as Permission[])]);
  return Array.from(set);
}

/**
 * Check if an admin has a specific permission.
 */
const PERMISSION_ALIASES: Partial<Record<Permission, Permission[]>> = {
  'forex:controls:manage': ['forex:control', 'control:trading'],
  'forex:control': ['forex:controls:manage', 'control:trading'],
  'forex:crm:view': ['forex:view'],
  'forex:compliance:view': ['forex:view'],
  'forex:finance:view': ['forex:view'],
  'forex:accounts:view': ['forex:view'],
};

export function hasPermission(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
  required: Permission,
): boolean {
  const perms = getEffectivePermissions(role, explicitPermissions);
  if (perms.includes('all') || perms.includes(required)) return true;
  const aliases = PERMISSION_ALIASES[required];
  if (aliases) return aliases.some((p) => perms.includes(p));
  if (required.endsWith(':view') && required !== 'forex:view' && perms.includes('forex:view')) return true;
  return false;
}

/**
 * Check if an admin has ANY of the listed permissions.
 */
export function hasAnyPermission(
  role: string | undefined,
  explicitPermissions: string[] | undefined,
  required: Permission[],
): boolean {
  return required.some((p) => hasPermission(role, explicitPermissions, p));
}

/**
 * Check if an admin is a super admin.
 */
export function isSuperAdmin(role: string | undefined): boolean {
  return SUPER_ROLES.has(normalizeRole(role));
}

/**
 * Get display label for a role.
 */
export function getRoleLabel(role: string | undefined): string {
  const LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    risk_manager: 'Risk Manager',
    finance_admin: 'Finance Admin',
    finance_ops: 'Finance Ops',
    support_agent: 'Support Agent',
    support: 'Support',
    compliance: 'Compliance',
    compliance_officer: 'Compliance Officer',
    auditor: 'Auditor',
    admin: 'Admin',
  };
  return LABELS[normalizeRole(role)] ?? role ?? 'Unknown';
}

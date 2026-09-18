/**
 * Global admin RBAC route map (default-deny: paths must match a rule).
 */

const SUPER_ROLES = ['super_admin', 'super admin', 'Super Admin'];
const ROLE_ALIASES: Record<string, string> = {
  support_agent: 'support',
  support: 'support',
  compliance_officer: 'compliance',
  compliance: 'compliance',
  finance_admin: 'finance_ops',
  finance_ops: 'finance_ops',
};

function normalizeRole(role: string): string {
  const normalized = (role || '').toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[normalized] ?? normalized;
}

export const ADMIN_IMPLICIT_ROLE_PERMISSIONS: Record<string, string[]> = {
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
    'forex:orders:manage',
    'forex:liquidity:manage',
    'forex:risk:manage',
    'markets:manage',
    'risk:export',
    'analytics:view',
    'audit:view',
    'forex:audit:view',
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
    'analytics:view',
    'audit:view',
    'forex:view',
    'forex:finance:view',
  ],
  support: ['users:view', 'users:edit', 'deposits:view', 'withdrawals:view', 'p2p:disputes', 'monitoring:view'],
  dealer: [
    'forex:view',
    'forex:dealing:view',
    'forex:dealing:manage',
    'forex:orders:view',
    'forex:positions:view',
    'forex:audit:view',
    'audit:view',
    'monitoring:view',
  ],
  senior_dealer: [
    'forex:view',
    'forex:dealing:view',
    'forex:dealing:manage',
    'forex:orders:view',
    'forex:orders:manage',
    'forex:positions:view',
    'forex:risk:view',
    'forex:audit:view',
    'audit:view',
    'monitoring:view',
  ],
  dealer_manager: [
    'forex:view',
    'forex:dealing:view',
    'forex:dealing:manage',
    'forex:orders:view',
    'forex:orders:manage',
    'forex:controls:view',
    'forex:audit:view',
    'audit:view',
    'monitoring:view',
  ],
  sales: ['forex:view', 'forex:crm:view', 'forex:crm:manage', 'users:view', 'audit:view'],
  account_manager: ['forex:view', 'forex:crm:view', 'forex:crm:manage', 'forex:accounts:view', 'users:view'],
  ib_manager: ['forex:view', 'forex:crm:view', 'forex:finance:view', 'forex:controls:manage', 'audit:view'],
  operations: [
    'forex:view',
    'forex:crm:view',
    'forex:accounts:view',
    'forex:orders:view',
    'forex:finance:view',
    'forex:compliance:view',
    'forex:audit:view',
    'monitoring:view',
    'audit:view',
  ],
  technical_admin: ['forex:view', 'forex:integrations:view', 'forex:controls:view', 'monitoring:view', 'settings:view'],
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
    'forex:compliance:manage',
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
  ],
  withdrawal_approver: ['withdrawals:approve'],
  kyc_reviewer: ['kyc:review'],
  aml_reviewer: ['aml:view'],
};

export const ADMIN_LEGACY_ROLE_PERMISSION: Record<string, string> = {
  withdrawal_approver: 'withdrawals:approve',
  kyc_reviewer: 'kyc:review',
  aml_reviewer: 'aml:view',
  risk_manager: 'monitoring:view',
  support_agent: 'users:view',
  finance_admin: 'withdrawals:view',
  compliance_officer: 'aml:view',
};

const LEGACY_FOREX_CONTROL_ALIASES: Record<string, string[]> = {
  'forex:controls:manage': ['forex:controls:manage', 'forex:control', 'control:trading'],
  'forex:control': ['forex:control', 'forex:controls:manage', 'control:trading'],
};

export function hasAdminRbacPermission(role: string, permission: string): boolean {
  const normalizedRole = normalizeRole(role);
  if (SUPER_ROLES.some((r) => r.toLowerCase().replace(/\s+/g, '_') === normalizedRole)) return true;
  const perms = ADMIN_IMPLICIT_ROLE_PERMISSIONS[normalizedRole] || [];
  if (perms.includes('all') || perms.includes(permission)) return true;
  const aliases = LEGACY_FOREX_CONTROL_ALIASES[permission];
  if (aliases) {
    return aliases.some((p) => perms.includes(p));
  }
  return false;
}

export function getImplicitRolePermissions(normalizedRole: string): string[] {
  return ADMIN_IMPLICIT_ROLE_PERMISSIONS[normalizeRole(normalizedRole)] ?? [];
}

/** URL pathname under /api/v1/admin (leading slash, no query). */
const ADMIN_ROUTE_RULES: Array<{ pattern: RegExp; read: string; write: string }> = [
  { pattern: /^\/monitoring\/actions\b/, read: 'monitoring:view', write: 'monitoring:control' },
  { pattern: /^\/settings\/api\/[^/]+\/send-test-alert\b/, read: 'settings:view', write: 'settings:edit' },
  { pattern: /^\/compliance\b/, read: 'aml:view', write: 'aml:escalate' },
  { pattern: /^\/(indexer|oracle)\b/, read: 'monitoring:view', write: 'settings:edit' },
  { pattern: /^\/(users|search|kyc)\b/, read: 'users:view', write: 'users:edit' },
  {
    pattern:
      /^\/(withdrawals|deposits|treasury|funds|hot-wallets|deposit-sweeps|wallets|cold-wallets|escrows)\b/,
    read: 'withdrawals:view',
    write: 'withdrawals:approve',
  },
  {
    pattern: /^\/(trading|trading-halt|matches|settlement|spot|engine|hybrid|external-liquidity)\b/,
    read: 'monitoring:view',
    write: 'markets:manage',
  },
  { pattern: /^\/(risk|aml)\b/, read: 'aml:view', write: 'aml:escalate' },
  {
    pattern: /^\/(system|settings|control|safe-mode|notification-prefs)\b/,
    read: 'settings:view',
    write: 'settings:edit',
  },
  {
    pattern: /^\/(monitoring|analytics|liquidity-bot|dashboard|dashboard-summary|system-health)\b/,
    read: 'analytics:view',
    write: 'analytics:view',
  },
  { pattern: /^\/(audit|security)\b/, read: 'audit:view', write: 'audit:view' },
  {
    pattern: /^\/(fees|staking|markets|announcements|notifications|support|p2p|referral)\b/,
    read: 'monitoring:view',
    write: 'settings:edit',
  },
  { pattern: /^\/(admin-users|roles)\b/, read: 'settings:view', write: 'settings:edit' },
  {
    pattern: /^\/(operations|operational|mm-control|proof-of-reserves|playbooks)\b/,
    read: 'analytics:view',
    write: 'settings:edit',
  },
  { pattern: /^\/incidents\b/, read: 'monitoring:view', write: 'settings:edit' },
  /** Forex admin — read forex:view; writes require forex:controls:manage (legacy forex:control / control:trading mapped in hasForexAdminPermission). */
  { pattern: /^\/forex\b/, read: 'forex:view', write: 'forex:controls:manage' },
];

export function isSuperAdminRole(role: string): boolean {
  const normalizedRole = normalizeRole(role);
  return SUPER_ROLES.some((r) => r.toLowerCase().replace(/\s+/g, '_') === normalizedRole);
}

/**
 * Default-deny RBAC: every authenticated admin route must match a rule and satisfy permission.
 */
export function evaluateAdminRouteRbac(
  role: string,
  method: string,
  adminRelativePath: string
): { allowed: boolean; required?: string; mapped?: boolean } {
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());
  for (const rule of ADMIN_ROUTE_RULES) {
    if (rule.pattern.test(adminRelativePath)) {
      const required = isWrite ? rule.write : rule.read;
      if (hasAdminRbacPermission(role, required)) {
        return { allowed: true, required, mapped: true };
      }
      const normalizedRole = normalizeRole(role);
      const legacy = ADMIN_LEGACY_ROLE_PERMISSION[normalizedRole];
      if (legacy === required) {
        return { allowed: true, required, mapped: true };
      }
      return { allowed: false, required, mapped: true };
    }
  }
  return { allowed: false, mapped: false };
}

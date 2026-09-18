/**
 * Shared Client 360 / CRM detail permission scoping (explicit grants — not forex:view bundle).
 */
import { hasAdminRbacPermission } from '../../../lib/admin-rbac-routes.js';
import type { ForexAdminCrmClientDetail } from './crm-clients.js';
import type { ForexAdminCrmClientActivitySnapshot } from './crm-client-activity.js';

export type ForexCrmSectionAccess = {
  compliance: boolean;
  finance: boolean;
  trading: boolean;
};

export function hasExplicitForexSectionPermission(role: string, permission: string): boolean {
  if (hasAdminRbacPermission(role, 'all')) return true;
  return hasAdminRbacPermission(role, permission);
}

export function resolveForexCrmSectionAccess(adminRole: string): ForexCrmSectionAccess {
  const canCompliance =
    hasExplicitForexSectionPermission(adminRole, 'forex:compliance:view') ||
    hasExplicitForexSectionPermission(adminRole, 'forex:compliance:manage');
  const canFinance =
    hasExplicitForexSectionPermission(adminRole, 'forex:finance:view') ||
    hasExplicitForexSectionPermission(adminRole, 'forex:finance:manage');
  const canTrading =
    hasExplicitForexSectionPermission(adminRole, 'forex:orders:view') ||
    hasExplicitForexSectionPermission(adminRole, 'forex:orders:manage') ||
    hasExplicitForexSectionPermission(adminRole, 'forex:positions:view');
  return { compliance: canCompliance, finance: canFinance, trading: canTrading };
}

export function scopeForexCrmClientDetail(
  detail: ForexAdminCrmClientDetail,
  access: ForexCrmSectionAccess,
): ForexAdminCrmClientDetail & { section_access: ForexCrmSectionAccess } {
  const scoped = { ...detail };
  if (!access.finance) {
    scoped.customer_cash_balance = 'REDACTED';
  }
  if (!access.compliance) {
    scoped.kyc_status = null;
    scoped.kyc_level = null;
    scoped.risk_level = 'low';
    scoped.risk_flags = [];
  }
  if (!access.trading) {
    scoped.open_orders = 0;
    scoped.open_positions = 0;
    scoped.recent_journal = [];
  }
  return { ...scoped, section_access: access };
}

export function scopeForexCrmClientActivity(
  snapshot: ForexAdminCrmClientActivitySnapshot,
  access: ForexCrmSectionAccess,
): ForexAdminCrmClientActivitySnapshot & { section_access: ForexCrmSectionAccess } {
  if (access.trading) {
    return { ...snapshot, section_access: access };
  }
  const items = snapshot.items.filter((i) => i.kind === 'journal');
  return {
    ...snapshot,
    items,
    limits: { ...snapshot.limits, orders: 0, executions: 0 },
    section_access: access,
  };
}

import type { ForexAdminRoute } from '@/lib/admin/forex-admin-nav';
import { FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';

export type ForexNavGroupId =
  | 'command'
  | 'trading'
  | 'risk'
  | 'crm'
  | 'accounts'
  | 'markets'
  | 'liquidity'
  | 'finance'
  | 'partners'
  | 'compliance'
  | 'automation'
  | 'reporting'
  | 'system';

export type ForexNavGroup = {
  id: ForexNavGroupId;
  label: string;
  description: string;
  routeIds: string[];
};

/** Tier-1 Forex operator IA — all routes preserved; groups reorganize navigation only. */
export const FOREX_NAV_GROUPS: ForexNavGroup[] = [
  {
    id: 'command',
    label: 'Command center',
    description: 'Posture, command desk, alerts, and runtime health',
    routeIds: ['overview', 'command', 'notifications', 'system'],
  },
  {
    id: 'trading',
    label: 'Trading',
    description: 'Orders, positions, executions, dealing, and protections',
    routeIds: ['orders', 'executions', 'positions', 'dealing', 'protection'],
  },
  {
    id: 'risk',
    label: 'Risk',
    description: 'Exposure, margin, liquidation, and control plane',
    routeIds: ['margin-risk', 'liquidation', 'risk-control'],
  },
  {
    id: 'crm',
    label: 'Clients & CRM',
    description: 'Leads, pipeline, client 360, workspace, and tasks',
    routeIds: [
      'crm-home',
      'crm-leads',
      'crm-pipeline',
      'crm-clients',
      'crm-my-clients',
      'crm-segments',
      'crm-tasks',
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    description: 'Trading accounts and group policy',
    routeIds: ['accounts', 'account-groups'],
  },
  {
    id: 'markets',
    label: 'Markets',
    description: 'Instruments, sessions, market data, fees and swaps',
    routeIds: ['instruments', 'sessions', 'market-data', 'fees-swaps'],
  },
  {
    id: 'liquidity',
    label: 'Liquidity & execution',
    description: 'LP posture, routing, and the broker gateway when it is configured',
    routeIds: ['lp-execution', 'liquidity-routing', 'integrations'],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Ledger, reconciliation, and CRM finance desk',
    routeIds: ['ledger', 'crm-finance'],
  },
  {
    id: 'partners',
    label: 'Partners / IB',
    description: 'IB profiles, commissions, and accruals. Payout rail status comes from configuration.',
    routeIds: ['forex-partners'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Cases and manual review (external screening NOT_CONNECTED)',
    routeIds: ['compliance'],
  },
  {
    id: 'automation',
    label: 'Automation',
    description: 'Workflows, rules, and execution logs',
    routeIds: ['automation'],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    description: 'Executive and domain BI from DB aggregates',
    routeIds: ['forex-reporting'],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Global controls, journal, and audit trail',
    routeIds: ['controls', 'journal-audit'],
  },
];

export function forexGroupForRouteId(routeId: string): ForexNavGroup {
  return FOREX_NAV_GROUPS.find((g) => g.routeIds.includes(routeId)) ?? FOREX_NAV_GROUPS[0]!;
}

export function forexGroupForPathname(pathname: string): ForexNavGroup {
  const route = (() => {
    if (pathname === '/forex') return FOREX_ADMIN_ROUTES.find((r) => r.id === 'overview');
    const matches = FOREX_ADMIN_ROUTES.filter((r) => r.href !== '/forex' && pathname.startsWith(r.href));
    matches.sort((a, b) => b.href.length - a.href.length);
    return matches[0];
  })();
  return forexGroupForRouteId(route?.id ?? 'overview');
}

export function forexRoutesInGroup(groupId: ForexNavGroupId): ForexAdminRoute[] {
  const group = FOREX_NAV_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  return group.routeIds
    .map((id) => FOREX_ADMIN_ROUTES.find((r) => r.id === id))
    .filter((r): r is ForexAdminRoute => !!r);
}

export type ForexRouteMaturity = 'production' | 'beta' | 'roadmap';

export const FOREX_ROUTE_MATURITY: Record<string, ForexRouteMaturity> = {
  overview: 'production',
  command: 'production',
  system: 'production',
  notifications: 'beta',
  instruments: 'production',
  sessions: 'production',
  'market-data': 'beta',
  orders: 'production',
  executions: 'production',
  positions: 'production',
  protection: 'beta',
  'margin-risk': 'production',
  'fees-swaps': 'production',
  dealing: 'beta',
  liquidation: 'beta',
  accounts: 'beta',
  ledger: 'beta',
  controls: 'production',
  'lp-execution': 'production',
  'journal-audit': 'beta',
  integrations: 'beta',
  'crm-home': 'beta',
  'crm-my-clients': 'beta',
  'crm-segments': 'beta',
  'crm-leads': 'beta',
  'crm-clients': 'beta',
  'crm-finance': 'beta',
  'crm-tasks': 'beta',
  'account-groups': 'beta',
  'liquidity-routing': 'beta',
  'crm-pipeline': 'beta',
  'forex-reporting': 'beta',
  'risk-control': 'beta',
  'forex-partners': 'beta',
  compliance: 'beta',
  automation: 'beta',
};

export function forexRouteMaturity(routeId: string): ForexRouteMaturity {
  return FOREX_ROUTE_MATURITY[routeId] ?? 'beta';
}

'use client';

/**
 * Forex administration — routes, section metadata, rollout phases.
 * Client-only (Lucide icons). Import from client components only.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Radio,
  Bell,
  CandlestickChart,
  CalendarClock,
  ShoppingCart,
  Zap,
  Layers,
  Shield,
  Gauge,
  Flame,
  Hand,
  Coins,
  Users,
  BookOpen,
  SlidersHorizontal,
  Cable,
  ScrollText,
  Server,
  Terminal,
  Plug,
  Contact,
  Route,
  Landmark,
  UserPlus,
  FolderKanban,
  ListTodo,
  GitBranch,
  BarChart3,
  ShieldAlert,
  Share2,
} from 'lucide-react';

export type ForexAdminPhase = 'F0' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export type ForexAdminRoute = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  phase: ForexAdminPhase;
  /** Shown in sidebar (subset); all routes appear in layout sub-nav */
  sidebar?: boolean;
};

/** Rollout phases — backend wiring follows this order */
export const FOREX_ADMIN_PHASES: { id: ForexAdminPhase; title: string; summary: string }[] = [
  {
    id: 'F0',
    title: 'Layout & control map',
    summary: 'Full admin shell, posture banner, every control surface mapped (UI shell).',
  },
  {
    id: 'F1',
    title: 'Read-only ops',
    summary: 'GET /admin/forex/config mirror, overview KPIs, instruments & sessions live data.',
  },
  {
    id: 'F2',
    title: 'Trading ops',
    summary: 'Orders, executions, positions, protection — searchable tables & exports.',
  },
  {
    id: 'F3',
    title: 'Global controls',
    summary: 'Kill switch, demo funding, per-instrument halt, economic-ready visibility.',
  },
  {
    id: 'F4',
    title: 'Policy edit',
    summary: 'Fees, swaps, leverage caps, margin ladders, dealing limits — RBAC + audit.',
  },
  {
    id: 'F5',
    title: 'LP & REAL_FOREX gate',
    summary: 'Provider health, execution mode, fill recon — locked until REAL_FOREX certified.',
  },
  {
    id: 'F6',
    title: 'Journal & compliance',
    summary: 'Customer journal, ledger recon tools, server alerts, user forex tab.',
  },
];

export const FOREX_ADMIN_ROUTES: ForexAdminRoute[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/forex',
    icon: LayoutDashboard,
    description: 'Posture, KPIs, and shortcuts into each desk.',
    phase: 'F0',
    sidebar: true,
  },
  {
    id: 'command',
    label: 'Command Desk',
    href: '/forex/command',
    icon: Terminal,
    description: 'Live KPIs, venue posture, quote worker, and incident shortcuts.',
    phase: 'F1',
    sidebar: true,
  },
  {
    id: 'notifications',
    label: 'Alerts & Notifications',
    href: '/forex/notifications',
    icon: Bell,
    description: 'Operator notification center — risk, dealing, CRM, finance, system.',
    phase: 'F1',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    href: '/forex/compliance',
    icon: Shield,
    description: 'KYC/AML cases and manual review (external providers NOT_CONNECTED).',
    phase: 'F6',
  },
  {
    id: 'automation',
    label: 'Automation',
    href: '/forex/automation',
    icon: SlidersHorizontal,
    description: 'Workflow triggers, conditions, actions, and execution history (safe dry-run).',
    phase: 'F4',
  },
  {
    id: 'instruments',
    label: 'Instruments',
    href: '/forex/instruments',
    icon: CandlestickChart,
    description: 'Symbol catalog, contract specs, trading status, volume bands.',
    phase: 'F1',
    sidebar: true,
  },
  {
    id: 'sessions',
    label: 'Sessions & Holidays',
    href: '/forex/sessions',
    icon: CalendarClock,
    description: 'Market hours, DST, holiday calendar, session eligibility.',
    phase: 'F1',
  },
  {
    id: 'market-data',
    label: 'Market Data',
    href: '/forex/market-data',
    icon: Radio,
    description: 'Quote providers, MOCK LP health, anchors, candle reference policy.',
    phase: 'F2',
    sidebar: true,
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/forex/orders',
    icon: ShoppingCart,
    description: 'Working, pending, and historical customer orders.',
    phase: 'F2',
    sidebar: true,
  },
  {
    id: 'executions',
    label: 'Executions & Fills',
    href: '/forex/executions',
    icon: Zap,
    description: 'MOCK venue executions, slippage, idempotency, fill lineage.',
    phase: 'F2',
  },
  {
    id: 'positions',
    label: 'Positions',
    href: '/forex/positions',
    icon: Layers,
    description: 'NETTING/HEDGING posture, open exposure, Close By / Reverse audit.',
    phase: 'F2',
  },
  {
    id: 'protection',
    label: 'Protection',
    href: '/forex/protection',
    icon: Shield,
    description: 'SL / TP / trailing stops, modify trails, trigger audit.',
    phase: 'F2',
  },
  {
    id: 'margin-risk',
    label: 'Risk overview',
    href: '/forex/margin-risk',
    icon: Gauge,
    description: 'Pre-trade gates, utilization, symbol exposure, policy snapshots.',
    phase: 'F4',
    sidebar: true,
  },
  {
    id: 'liquidation',
    label: 'Liquidation',
    href: '/forex/liquidation',
    icon: Flame,
    description: 'Stop-out events, locks, maintenance margin, recovery.',
    phase: 'F2',
  },
  {
    id: 'dealing',
    label: 'Dealing Desk',
    href: '/forex/dealing',
    icon: Hand,
    description: 'Dealing limits, last look, reject reasons, desk overrides.',
    phase: 'F3',
    sidebar: true,
  },
  {
    id: 'fees-swaps',
    label: 'Fees & Swaps',
    href: '/forex/fees-swaps',
    icon: Coins,
    description: 'Commission models, swap rollover, triple swap, instrument overrides.',
    phase: 'F4',
    sidebar: true,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    href: '/forex/accounts',
    icon: Users,
    description: 'Forex ledger accounts, mode (NETTING), restrictions, demo funding.',
    phase: 'F2',
  },
  {
    id: 'account-groups',
    label: 'Account Groups',
    href: '/forex/account-groups',
    icon: FolderKanban,
    description: 'Group codes, leverage defaults, and account assignment policy.',
    phase: 'F2',
    sidebar: true,
  },
  {
    id: 'crm-home',
    label: 'CRM Home',
    href: '/forex/crm/home',
    icon: LayoutDashboard,
    description: 'Funnel, workload, tasks, and onboarding bottlenecks from CRM data.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-my-clients',
    label: 'My Clients',
    href: '/forex/crm/my-clients',
    icon: Users,
    description: 'Account manager workspace — assigned clients, tasks, and attention queue.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-leads',
    label: 'CRM — Leads',
    href: '/forex/crm/leads',
    icon: UserPlus,
    description: 'Lead pipeline, assignment, conversion to Forex accounts.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-clients',
    label: 'CRM — Clients',
    href: '/forex/crm/clients',
    icon: Contact,
    description: 'Forex trading clients — accounts linked to platform users (read-only).',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-finance',
    label: 'CRM — Finance',
    href: '/forex/crm/finance',
    icon: Landmark,
    description: 'Ledger balances, transaction tail, and reconciliation for finance ops.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-tasks',
    label: 'CRM — Tasks',
    href: '/forex/crm/tasks',
    icon: ListTodo,
    description: 'Follow-ups linked to leads or Forex accounts.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-segments',
    label: 'CRM — Segments',
    href: '/forex/crm/segments',
    icon: FolderKanban,
    description: 'Predefined client cohorts (VIP, KYC pending, active traders, etc.).',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'crm-pipeline',
    label: 'CRM — Pipeline',
    href: '/forex/crm/pipeline',
    icon: GitBranch,
    description: 'Lead counts by stage from authoritative CRM data.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'forex-reporting',
    label: 'Reporting',
    href: '/forex/reporting',
    icon: BarChart3,
    description: 'DB-backed operational metrics with explicit sources.',
    phase: 'F2',
    sidebar: true,
  },
  {
    id: 'risk-control',
    label: 'Risk controls',
    href: '/forex/risk-control',
    icon: ShieldAlert,
    description: 'Effective controls with PERSISTED vs ENGINE-APPLIED labels.',
    phase: 'F4',
    sidebar: true,
  },
  {
    id: 'forex-partners',
    label: 'Partners / IB',
    href: '/forex/partners',
    icon: Share2,
    description: 'Forex IB profiles and attribution (not Crypto referral).',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'ledger',
    label: 'Ledger & Recon',
    href: '/forex/ledger',
    icon: BookOpen,
    description: 'Double-entry trail, reconciliation status, export for finance.',
    phase: 'F2',
  },
  {
    id: 'controls',
    label: 'Global Controls',
    href: '/forex/controls',
    icon: SlidersHorizontal,
    description: 'Kill switch, order types/TIF policy, funding & test APIs.',
    phase: 'F3',
    sidebar: true,
  },
  {
    id: 'lp-execution',
    label: 'LP & Execution',
    href: '/forex/lp-execution',
    icon: Cable,
    description: 'REAL_FOREX gate, LP adapters, routing, fill reconciliation.',
    phase: 'F5',
    sidebar: true,
  },
  {
    id: 'liquidity-routing',
    label: 'Routing desk',
    href: '/forex/liquidity/routing',
    icon: Route,
    description: 'Per-symbol MOCK LP routing snapshot and S3 feature flags.',
    phase: 'F5',
    sidebar: true,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/forex/integrations',
    icon: Plug,
    description: 'Multi-broker adapters, connection status, and provider catalog.',
    phase: 'F5',
    sidebar: true,
  },
  {
    id: 'journal-audit',
    label: 'Journal & Audit',
    href: '/forex/journal-audit',
    icon: ScrollText,
    description: 'Customer journal, admin config changes, forensic exports.',
    phase: 'F6',
    sidebar: true,
  },
  {
    id: 'system',
    label: 'System',
    href: '/forex/system',
    icon: Server,
    description: 'Market readiness, quote worker, and platform runtime diagnostics.',
    phase: 'F1',
    sidebar: true,
  },
];

export function forexSidebarItems(): ForexAdminRoute[] {
  return FOREX_ADMIN_ROUTES.filter((r) => r.sidebar);
}

export function forexRouteByHref(pathname: string): ForexAdminRoute | undefined {
  if (pathname === '/forex') return FOREX_ADMIN_ROUTES.find((r) => r.id === 'overview');
  const matches = FOREX_ADMIN_ROUTES.filter((r) => r.href !== '/forex' && pathname.startsWith(r.href));
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0];
}

export function isForexAdminPath(pathname: string): boolean {
  return pathname === '/forex' || pathname.startsWith('/forex/');
}

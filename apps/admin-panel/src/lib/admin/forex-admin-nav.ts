/**
 * Forex FDM admin — routes, section metadata, rollout phases.
 * Single source for sidebar, in-layout sub-nav, pageMeta, and command palette.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Radio,
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
    description: 'Posture, KPIs, and links to every control domain.',
    phase: 'F0',
    sidebar: true,
  },
  {
    id: 'command',
    label: 'Command Desk',
    href: '/forex/command',
    icon: Terminal,
    description: 'Operator console: hydration, worker, quick actions, incident hooks.',
    phase: 'F1',
    sidebar: true,
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
    label: 'Margin & Risk',
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
    id: 'journal-audit',
    label: 'Journal & Audit',
    href: '/forex/journal-audit',
    icon: ScrollText,
    description: 'Customer journal, admin config changes, forensic exports.',
    phase: 'F6',
  },
  {
    id: 'system',
    label: 'System',
    href: '/forex/system',
    icon: Server,
    description: 'Hydration, workers, prometheus hooks, FOREX_NOT_READY diagnostics.',
    phase: 'F1',
    sidebar: true,
  },
];

export function forexSidebarItems(): ForexAdminRoute[] {
  return FOREX_ADMIN_ROUTES.filter((r) => r.sidebar);
}

export function forexRouteByHref(pathname: string): ForexAdminRoute | undefined {
  if (pathname === '/forex') return FOREX_ADMIN_ROUTES.find((r) => r.id === 'overview');
  return FOREX_ADMIN_ROUTES.find((r) => r.href !== '/forex' && pathname.startsWith(r.href));
}

export function isForexAdminPath(pathname: string): boolean {
  return pathname === '/forex' || pathname.startsWith('/forex/');
}

/**
 * Maximum control catalog for Forex FDM admin — UI maps every planned knob.
 * `wired: false` until backend `/api/v1/admin/forex/*` implements the action.
 */
import type { ForexAdminPhase } from '@/lib/admin/forex-admin-nav';

export type ForexControlKind = 'toggle' | 'select' | 'number' | 'action' | 'readonly' | 'table';

export type ForexControlDef = {
  id: string;
  label: string;
  description: string;
  kind: ForexControlKind;
  phase: ForexAdminPhase;
  wired: boolean;
  dangerous?: boolean;
};

export type ForexControlGroup = {
  id: string;
  title: string;
  sectionRoute: string;
  controls: ForexControlDef[];
};

export const FOREX_CONTROL_GROUPS: ForexControlGroup[] = [
  {
    id: 'posture',
    title: 'Runtime posture',
    sectionRoute: '/forex',
    controls: [
      { id: 'source', label: 'Quote source', description: 'SIMULATED vs live LP feed', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'execution_mode', label: 'Execution mode', description: 'MOCK venue vs broker bridge', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'real_forex', label: 'REAL_FOREX master gate', description: 'Blocks real-money path when OFF', kind: 'readonly', phase: 'F5', wired: true },
      { id: 'economic_ready', label: 'Economic hydration', description: 'Forex ready for trading routes', kind: 'readonly', phase: 'F1', wired: false },
    ],
  },
  {
    id: 'global-controls',
    title: 'Emergency & global',
    sectionRoute: '/forex/controls',
    controls: [
      { id: 'kill_switch', label: 'Global kill switch', description: 'Reject new forex orders platform-wide', kind: 'toggle', phase: 'F3', wired: true, dangerous: true },
      { id: 'demo_funding', label: 'Demo funding API', description: 'Allow demo ledger credits', kind: 'toggle', phase: 'F3', wired: true },
      { id: 'funding_test_api', label: 'Funding test API', description: 'Ops-only funding test header', kind: 'toggle', phase: 'F3', wired: true },
      { id: 'execution_test_api', label: 'Execution test API', description: 'Simulated test execution endpoint', kind: 'toggle', phase: 'F3', wired: true },
      { id: 'order_types_policy', label: 'Customer order types', description: 'market / limit / stop / stop_limit', kind: 'select', phase: 'F4', wired: false },
      { id: 'tif_policy', label: 'Time in force', description: 'GTC / IOC / FOK / DAY', kind: 'select', phase: 'F4', wired: false },
    ],
  },
  {
    id: 'instruments',
    title: 'Instruments',
    sectionRoute: '/forex/instruments',
    controls: [
      { id: 'catalog', label: 'Instrument catalog', description: 'Symbols, digits, contract size', kind: 'table', phase: 'F1', wired: false },
      { id: 'trading_status', label: 'Per-symbol trading status', description: 'active / close-only / halted', kind: 'select', phase: 'F3', wired: true },
      { id: 'leverage_cap', label: 'Max leverage per symbol', description: 'Instrument leverage ceiling', kind: 'number', phase: 'F4', wired: true },
      { id: 'volume_bands', label: 'Min / max volume', description: 'Lot size constraints', kind: 'number', phase: 'F4', wired: false },
    ],
  },
  {
    id: 'sessions',
    title: 'Sessions & calendar',
    sectionRoute: '/forex/sessions',
    controls: [
      { id: 'session_snapshot', label: 'Session eligibility', description: 'Open / closed by symbol', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'holiday_calendar', label: 'Holiday calendar', description: 'DST-safe holiday coverage', kind: 'table', phase: 'F4', wired: false },
      { id: 'day_order_expiry', label: 'DAY order expiry', description: 'Expire working orders on session close', kind: 'toggle', phase: 'F4', wired: false },
    ],
  },
  {
    id: 'market-data',
    title: 'Market data',
    sectionRoute: '/forex/market-data',
    controls: [
      { id: 'mock_providers', label: 'MOCK LP providers', description: 'MOCK-A/B/C health & failover', kind: 'table', phase: 'F2', wired: false },
      { id: 'quote_persist', label: 'Quote persistence', description: 'forex_quotes write load & retention', kind: 'readonly', phase: 'F2', wired: false },
      { id: 'external_candles', label: 'External candles', description: 'Yahoo reference — non-execution', kind: 'readonly', phase: 'F1', wired: false },
    ],
  },
  {
    id: 'trading-ops',
    title: 'Trading operations',
    sectionRoute: '/forex/orders',
    controls: [
      { id: 'open_orders', label: 'Open & pending orders', description: 'Search, filter, export', kind: 'table', phase: 'F2', wired: false },
      { id: 'cancel_order', label: 'Force cancel (ops)', description: 'Cancel stuck working order', kind: 'action', phase: 'F3', wired: false, dangerous: true },
      { id: 'executions', label: 'Execution attempts', description: 'MOCK fill audit trail', kind: 'table', phase: 'F2', wired: false },
      { id: 'positions', label: 'Open positions', description: 'Exposure by account & symbol', kind: 'table', phase: 'F2', wired: false },
    ],
  },
  {
    id: 'risk',
    title: 'Margin & risk',
    sectionRoute: '/forex/margin-risk',
    controls: [
      { id: 'pretrade', label: 'Pre-trade checks', description: 'Margin, exposure, kill switch', kind: 'readonly', phase: 'F2', wired: false },
      { id: 'policy_snapshot', label: 'Risk policy snapshot', description: 'Limits from risk service', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'global_leverage', label: 'Global max leverage', description: 'Platform ceiling', kind: 'number', phase: 'F4', wired: true },
      { id: 'margin_levels', label: 'Margin call / stop-out', description: 'Warning, call, stop-out %', kind: 'number', phase: 'F4', wired: true },
    ],
  },
  {
    id: 'dealing',
    title: 'Dealing desk',
    sectionRoute: '/forex/dealing',
    controls: [
      { id: 'dealing_snapshot', label: 'Dealing snapshot', description: 'Desk limits & reject stats', kind: 'readonly', phase: 'F2', wired: false },
      { id: 'last_look', label: 'Last look (future)', description: 'LP last-look ms', kind: 'number', phase: 'F5', wired: false },
      { id: 'manual_intervention', label: 'Manual reject / hold', description: 'Hold account or symbol', kind: 'action', phase: 'F3', wired: false, dangerous: true },
    ],
  },
  {
    id: 'fees',
    title: 'Fees & swaps',
    sectionRoute: '/forex/fees-swaps',
    controls: [
      { id: 'commission_policies', label: 'Commission policies', description: 'Per-lot / percent models', kind: 'table', phase: 'F4', wired: true },
      { id: 'swap_policies', label: 'Swap / rollover', description: 'Rollover time & triple swap', kind: 'table', phase: 'F4', wired: true },
    ],
  },
  {
    id: 'lp',
    title: 'LP & execution',
    sectionRoute: '/forex/lp-execution',
    controls: [
      { id: 'lp_routing', label: 'LP routing table', description: 'Primary / backup LP', kind: 'table', phase: 'F5', wired: true },
      { id: 'enable_real_forex', label: 'Enable REAL_FOREX', description: 'Requires certification checklist', kind: 'toggle', phase: 'F5', wired: true, dangerous: true },
      { id: 'fill_recon', label: 'Fill reconciliation', description: 'LP vs internal fills', kind: 'table', phase: 'F5', wired: true },
    ],
  },
  {
    id: 'journal',
    title: 'Journal & audit',
    sectionRoute: '/forex/journal-audit',
    controls: [
      { id: 'customer_journal', label: 'Customer journal tail', description: 'Per-account event stream', kind: 'table', phase: 'F6', wired: false },
      { id: 'config_audit', label: 'Forex config audit', description: 'Who changed policy & when', kind: 'table', phase: 'F6', wired: false },
    ],
  },
  {
    id: 'system',
    title: 'System',
    sectionRoute: '/forex/system',
    controls: [
      { id: 'hydrate_status', label: 'Hydration / recovery', description: 'Last hydrate result & duration', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'worker_tick', label: 'Market-data worker', description: 'Interval, symbols, provider list', kind: 'readonly', phase: 'F1', wired: false },
      { id: 'prometheus', label: 'Forex metrics', description: 'Hydrate, recovery, order counters', kind: 'readonly', phase: 'F2', wired: false },
    ],
  },
];

export function controlGroupsForRoute(href: string): ForexControlGroup[] {
  if (href === '/forex') return FOREX_CONTROL_GROUPS;
  return FOREX_CONTROL_GROUPS.filter((g) => g.sectionRoute === href || href.startsWith(g.sectionRoute + '/'));
}

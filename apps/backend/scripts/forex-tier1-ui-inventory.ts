/**
 * Fresh Forex Tier-1 UI/domain inventory (machine-readable).
 * Output: .build/forex-tier1-ui-completion-inventory.json
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '../..');
const out = path.join(root, '.build/forex-tier1-ui-completion-inventory.json');

type Status = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_CONFIGURED' | 'BLOCKED' | 'NOT_APPLICABLE';

type DomainEntry = {
  domain: string;
  route: string;
  frontend_component: string;
  api_routes: string[];
  db_tables: string[];
  ui_completeness: Status;
  missing_ui: string[];
  missing_api: string[];
  missing_tests: string[];
  security_status: Status;
  visual_ux_status: Status;
  final_status: Status;
  notes: string;
};

const domains: DomainEntry[] = [
  {
    domain: 'Command Center',
    route: '/forex/command',
    frontend_component: 'ForexCommandDeskPanel',
    api_routes: ['GET /forex/overview', 'GET /forex/system'],
    db_tables: ['forex_orders', 'forex_quotes'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Unified approvals/incidents strip'],
    missing_api: [],
    missing_tests: ['forex-command-desk workflow spec'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'KPIs live; deeper incident workflow partial.',
  },
  {
    domain: 'CRM Home',
    route: '/forex/crm/home',
    frontend_component: 'ForexCrmHomePanel',
    api_routes: ['GET /forex/crm/home', 'GET /forex/crm/pipeline'],
    db_tables: ['forex_crm_leads', 'forex_crm_lead_stages', 'forex_crm_tasks'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Activity timeline widget', 'Lead source performance chart'],
    missing_api: ['GET /forex/crm/segments'],
    missing_tests: ['functional-crm-home.spec.ts'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'Added in Tier-1 pass — funnel + tasks from DB.',
  },
  {
    domain: 'My Clients',
    route: '/forex/crm/my-clients',
    frontend_component: 'ForexCrmMyClientsPanel',
    api_routes: ['GET /forex/crm/workspace'],
    db_tables: ['forex_crm_client_profiles', 'forex_crm_tasks', 'forex_crm_leads'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Inline client list for assigned accounts'],
    missing_api: [],
    missing_tests: ['functional-crm-workspace.spec.ts'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'Attention queue + task summary.',
  },
  {
    domain: 'CRM Leads',
    route: '/forex/crm/leads',
    frontend_component: 'ForexCrmLeadsPanel + ForexCrmLeadDetailPanel',
    api_routes: ['GET/POST /forex/crm/leads', 'PATCH stage', 'POST assign', 'POST convert'],
    db_tables: ['forex_crm_leads'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Activities tab on lead detail', 'Tags editor'],
    missing_api: ['GET /forex/crm/activities per lead'],
    missing_tests: ['browser lead assign flow'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'Create/convert/assign supported; segments missing.',
  },
  {
    domain: 'Client 360',
    route: '/forex/crm/clients/[accountId]',
    frontend_component: 'ForexCrmClientDetailPanel',
    api_routes: ['GET /forex/crm/clients/:id', 'GET /360', 'GET activity', 'POST notes'],
    db_tables: ['forex_accounts', 'forex_crm_client_profiles', 'forex_crm_notes'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Tabbed IA (Trading/Finance/Compliance tabs as spec)'],
    missing_api: [],
    missing_tests: ['client-360 browser workflow'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: '360 API wired; UX not full tabbed cockpit yet.',
  },
  {
    domain: 'Dealing Desk',
    route: '/forex/dealing',
    frontend_component: 'ForexDealingDeskPanel',
    api_routes: ['GET /forex/dealing/queue', 'POST accept/reject/assign/escalate'],
    db_tables: ['forex_orders', 'forex_dealing_actions'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Order detail drawer', 'ForexConfirmModal instead of window.prompt'],
    missing_api: [],
    missing_tests: ['browser dealing accept'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'MOCK dealer actions live; workstation density below MT5-class target.',
  },
  {
    domain: 'Reporting',
    route: '/forex/reporting',
    frontend_component: 'ForexReportingPanel',
    api_routes: ['GET /forex/reporting/snapshot?from&to'],
    db_tables: ['forex_orders', 'forex_partner_*', 'forex_automation_*'],
    ui_completeness: 'PARTIAL',
    missing_ui: ['Executive/Trading/Finance sub-nav', 'Charts/export'],
    missing_api: [],
    missing_tests: ['functional-reporting.spec.ts'],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'Date range wired; single metrics table only.',
  },
  {
    domain: 'Integrations',
    route: '/forex/integrations',
    frontend_component: 'ForexIntegrationsPanel',
    api_routes: ['GET /forex/integrations'],
    db_tables: [],
    ui_completeness: 'PARTIAL',
    missing_ui: [],
    missing_api: [],
    missing_tests: [],
    security_status: 'COMPLETE',
    visual_ux_status: 'PARTIAL',
    final_status: 'PARTIAL',
    notes: 'External MT5/FIX/LP correctly NOT_CONFIGURED.',
  },
  {
    domain: 'External LP / REAL_FOREX',
    route: 'N/A',
    frontend_component: 'ForexExecutionPanel',
    api_routes: ['GET /forex/execution/real-forex'],
    db_tables: [],
    ui_completeness: 'NOT_APPLICABLE',
    missing_ui: [],
    missing_api: [],
    missing_tests: [],
    security_status: 'COMPLETE',
    visual_ux_status: 'NOT_APPLICABLE',
    final_status: 'NOT_CONFIGURED',
    notes: 'REAL_FOREX=false by policy — not a defect.',
  },
  {
    domain: 'Crypto isolation',
    route: 'N/A',
    frontend_component: 'N/A',
    api_routes: [],
    db_tables: ['exchange only — not forex cert'],
    ui_completeness: 'NOT_APPLICABLE',
    missing_ui: [],
    missing_api: [],
    missing_tests: ['forex-safe-crypto-regression.sh'],
    security_status: 'PARTIAL',
    visual_ux_status: 'NOT_APPLICABLE',
    final_status: 'BLOCKED',
    notes: 'Staging exchange DB settlement chain may fail pre-existing; Forex cert isolated.',
  },
];

const navSrc = readFileSync(path.join(root, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts'), 'utf8');
const navPaths = [...navSrc.matchAll(/href: '(\/forex[^']*)'/g)].map((m) => m[1]);

const body = {
  generated_at: new Date().toISOString(),
  product: 'Unified Trading Platform',
  domain_scope: 'Forex',
  execution_mode: 'MOCK/SIMULATED',
  real_forex: false,
  route_count: navPaths.length,
  routes: navPaths,
  domains,
  scan: {
    operator_placeholder_phrases_remaining: ['ForexIntegrationsPanel catalog placeholders (honest NOT_CONFIGURED)'],
    forex_debug_payload_on_operator_pages: false,
  },
  completion_gate: {
    all_domains_complete: false,
    actionable_partial_count: domains.filter((d) => d.final_status === 'PARTIAL').length,
  },
};

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(body, null, 2));
console.log(JSON.stringify({ ok: true, out, domains: domains.length }));

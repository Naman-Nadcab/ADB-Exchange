#!/usr/bin/env node
/**
 * Honest Forex UI change inventory — git delta + route → component mapping.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.build/forex-ui-change-inventory.json');

const ROUTE_MAP = {
  '/forex': { id: 'overview', component: 'forex/page.tsx + ForexCommandDeskPanel' },
  '/forex/command': { id: 'command', component: 'ForexSectionPage → ForexCommandDeskPanel' },
  '/forex/notifications': { id: 'notifications', component: 'ForexNotificationsPanel' },
  '/forex/compliance': { id: 'compliance', component: 'ForexCompliancePanel' },
  '/forex/automation': { id: 'automation', component: 'ForexAutomationPanel' },
  '/forex/instruments': { id: 'instruments', component: 'ForexInstrumentsPanel' },
  '/forex/sessions': { id: 'sessions', component: 'ForexSessionsPanel + ForexHolidayCalendarPanel' },
  '/forex/market-data': { id: 'market-data', component: 'ForexMarketDataPanel' },
  '/forex/orders': { id: 'orders', component: 'ForexAdminOpsTable' },
  '/forex/executions': { id: 'executions', component: 'ForexAdminOpsTable' },
  '/forex/positions': { id: 'positions', component: 'ForexAdminOpsTable' },
  '/forex/protection': { id: 'protection', component: 'ForexProtectionPanel' },
  '/forex/margin-risk': { id: 'margin-risk', component: 'ForexPolicyPanel' },
  '/forex/liquidation': { id: 'liquidation', component: 'ForexLiquidationPanel' },
  '/forex/dealing': { id: 'dealing', component: 'ForexDealingDeskPanel' },
  '/forex/fees-swaps': { id: 'fees-swaps', component: 'ForexPolicyPanel' },
  '/forex/accounts': { id: 'accounts', component: 'ForexTradingAccountsPanel' },
  '/forex/account-groups': { id: 'account-groups', component: 'ForexAccountGroupsPanel' },
  '/forex/crm/home': { id: 'crm-home', component: 'ForexCrmHomePanel' },
  '/forex/crm/my-clients': { id: 'crm-my-clients', component: 'ForexCrmMyClientsPanel' },
  '/forex/crm/leads': { id: 'crm-leads', component: 'ForexCrmLeadsPanel' },
  '/forex/crm/clients': { id: 'crm-clients', component: 'ForexCrmClientsPanel' },
  '/forex/crm/finance': { id: 'crm-finance', component: 'ForexCrmFinancePanel' },
  '/forex/crm/tasks': { id: 'crm-tasks', component: 'ForexCrmTasksPanel' },
  '/forex/crm/segments': { id: 'crm-segments', component: 'ForexCrmSegmentsPanel' },
  '/forex/crm/pipeline': { id: 'crm-pipeline', component: 'ForexCrmPipelinePanel' },
  '/forex/reporting': { id: 'forex-reporting', component: 'ForexReportingPanel' },
  '/forex/risk-control': { id: 'risk-control', component: 'ForexRiskControlPanel + ForexRiskHubPanel' },
  '/forex/partners': { id: 'forex-partners', component: 'ForexPartnersPanel' },
  '/forex/ledger': { id: 'ledger', component: 'ForexLedgerPanel' },
  '/forex/controls': { id: 'controls', component: 'ForexGlobalControlsPanel' },
  '/forex/lp-execution': { id: 'lp-execution', component: 'ForexExecutionPanel' },
  '/forex/liquidity/routing': { id: 'liquidity-routing', component: 'ForexRoutingDeskPanel' },
  '/forex/integrations': { id: 'integrations', component: 'ForexIntegrationsPanel' },
  '/forex/journal-audit': { id: 'journal-audit', component: 'ForexJournalAuditPanel' },
  '/forex/system': { id: 'system', component: 'ForexSystemPanel' },
};

function gitFileStatus(rel) {
  try {
    const out = execSync(`git status --porcelain -- "${rel}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (!out) return 'committed_unchanged';
    if (out.startsWith('??')) return 'untracked';
    if (out.startsWith(' M') || out.startsWith('M ')) return 'modified';
    if (out.startsWith(' D') || out.startsWith('D ')) return 'deleted';
    return out.slice(0, 2).trim() || 'changed';
  } catch {
    return 'unknown';
  }
}

function componentFiles(component) {
  const files = [];
  const panelMatch = component.match(/Forex[A-Za-z]+Panel|ForexAdminOpsTable|Forex[A-Za-z]+Page/);
  if (panelMatch) {
    const name = panelMatch[0];
    for (const dir of ['apps/admin-panel/src/components/forex/panels', 'apps/admin-panel/src/components/forex']) {
      const p = path.join(dir, `${name}.tsx`);
      if (fs.existsSync(path.join(ROOT, p))) files.push(p);
    }
  }
  if (component.includes('ForexSectionPage')) files.push('apps/admin-panel/src/components/forex/ForexSectionPage.tsx');
  if (component.includes('forex/page.tsx')) files.push('apps/admin-panel/src/app/(protected)/forex/page.tsx');
  return [...new Set(files)];
}

function linesChanged(rel) {
  try {
    const diff = execSync(`git diff HEAD -- "${rel}" 2>/dev/null | wc -l`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return Number.parseInt(diff, 10) || 0;
  } catch {
    return 0;
  }
}

const panelDirStatus = gitFileStatus('apps/admin-panel/src/components/forex/panels');
const inventory = {
  generatedAt: new Date().toISOString(),
  git_head: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
  note: 'panels/ is largely untracked WIP — live Docker build includes working tree. Prior GREEN cert used weak string markers only.',
  panels_directory_git: panelDirStatus,
  routes: [],
};

for (const [route, meta] of Object.entries(ROUTE_MAP)) {
  const files = componentFiles(meta.component);
  const fileDetails = files.map((f) => ({
    path: f,
    git_status: gitFileStatus(f),
    diff_lines_vs_head: linesChanged(f),
    exists: fs.existsSync(path.join(ROOT, f)),
  }));
  const anyModified = fileDetails.some((f) => f.git_status === 'modified' || f.git_status === 'untracked');
  const meaningful =
    fileDetails.some((f) => f.diff_lines_vs_head > 40) ||
    (panelDirStatus === 'untracked' && meta.component.includes('Panel'));

  inventory.routes.push({
    route,
    route_id: meta.id,
    page_component: meta.component,
    files: fileDetails,
    meaningful_ui_change_in_git: meaningful,
    ui_depth_claim: meaningful || anyModified ? 'NEEDS_VISUAL_VERIFY' : 'LEGACY_ONLY',
    certification_status: 'REVALIDATION',
    api_changes: route === '/forex/market-data' ? ['GET /forex/market-data/quotes'] : route === '/forex/accounts' ? ['GET /forex/accounts/list'] : [],
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(inventory, null, 2));
console.log('Wrote', OUT, 'routes', inventory.routes.length);

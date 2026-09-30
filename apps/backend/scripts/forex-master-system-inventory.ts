/**
 * Master Forex system inventory — repo + deployment truth snapshot.
 * Output: .build/forex-master-system-inventory.json
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '../..');
const out = path.join(root, '.build/forex-master-system-inventory.json');

function sh(cmd: string): string {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function httpCode(url: string): number | null {
  const r = sh(`curl -sf -o /dev/null -w '%{http_code}' '${url}'`);
  const n = Number.parseInt(r, 10);
  return Number.isFinite(n) ? n : null;
}

const commit = sh('git rev-parse HEAD');
const branch = sh('git branch --show-current');
const routeCount = (readFileSync(path.join(root, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts'), 'utf8').match(/href: '\/forex/g) ?? []).length;

const certRoutes = ['home', 'my-clients', 'segments'].map((p) => ({
  path: `/forex/crm/${p}`,
  cert_3010: httpCode(`http://127.0.0.1:3010/admin/forex/crm/${p}`),
  live_80: httpCode(`http://127.0.0.1/admin/forex/crm/${p}`),
  public_vps: httpCode(`http://109.123.254.30/admin/forex/crm/${p}`),
}));

const doc = {
  generated_at: new Date().toISOString(),
  product: 'Unified Trading Platform — Forex Admin / CRM / Operations',
  repository: { commit, branch, forex_admin_routes: routeCount },
  execution: {
    real_forex: false,
    mock_simulated: true,
    external_lp: 'NOT_CONFIGURED',
    mt4: 'DISABLED',
    mt5: 'DISABLED',
    fix: 'DISABLED',
    ctrader: 'DISABLED',
  },
  environments: {
    certification: {
      admin: 'http://127.0.0.1:3010/admin (host next start, API :4100)',
      forex_api: 'http://127.0.0.1:4100 (forex-cert-backend, exchange_forex_cert DB)',
      container: 'forex-cert-backend',
    },
    live_vps: {
      operator_url: 'http://109.123.254.30/admin',
      nginx_upstream: 'admin-panel:3001 → exchange-admin container',
      api: 'exchange-backend :4000 via nginx /api',
      host: sh('hostname') || 'unknown',
    },
  },
  deployment_drift_probe: certRoutes,
  domains: [
    'Command Center',
    'CRM',
    'Client 360',
    'Trading',
    'Dealing',
    'Risk',
    'Accounts',
    'Markets',
    'Finance',
    'Partners',
    'Compliance',
    'Automation',
    'Reporting',
    'Global Controls',
    'Audit',
    'Integrations',
    'System',
  ],
  prior_artifacts: [
    '.build/forex-tier1-ui-completion-inventory.json',
    '.build/forex-tier1-gap-register.json',
    '.build/forex-live-ui-verification.json',
  ],
  notes: [
    'Cert :3010 and live :80/admin are different processes; CRM Phase A routes 404 on live until exchange-admin image rebuild.',
    'Crypto financial core must not be modified during Forex UI deployment.',
  ],
};

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(JSON.stringify({ ok: true, out, commit: commit.slice(0, 8), drift: certRoutes }));

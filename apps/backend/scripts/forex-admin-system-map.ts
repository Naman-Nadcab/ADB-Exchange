/**
 * Forex Admin system map — routes × capability matrix.
 * Output: .build/forex-admin-system-map.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '../..');
const navPath = path.join(root, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts');
const groupsPath = path.join(root, 'apps/admin-panel/src/lib/admin/forex-nav-groups.ts');
const out = path.join(root, '.build/forex-admin-system-map.json');

type Dim = 'YES' | 'PARTIAL' | 'NO' | 'NOT_CONFIGURED' | 'N/A';

const navSrc = readFileSync(navPath, 'utf8');
const routeBlocks = [...navSrc.matchAll(/id: '([^']+)'[\s\S]*?href: '([^']+)'[\s\S]*?label: '([^']+)'/g)];

const routes = routeBlocks.map((m) => ({
  id: m[1],
  href: m[2],
  label: m[3],
}));

const groupsSrc = readFileSync(groupsPath, 'utf8');
const groupLabels = [...groupsSrc.matchAll(/id: '([^']+)'[\s\S]*?label: '([^']+)'/g)].map((m) => ({
  id: m[1],
  label: m[2],
}));

const features = routes.map((r) => ({
  route_id: r.id,
  href: r.href,
  label: r.label,
  backend: 'PARTIAL' as Dim,
  api: 'PARTIAL' as Dim,
  db: 'PARTIAL' as Dim,
  frontend: 'YES' as Dim,
  cert_ui: 'PARTIAL' as Dim,
  live_vps_ui: 'PARTIAL' as Dim,
  functional: 'PARTIAL' as Dim,
  rbac: 'PARTIAL' as Dim,
  audit: 'PARTIAL' as Dim,
  test: 'PARTIAL' as Dim,
  visual: 'PARTIAL' as Dim,
  notes: 'Auto-generated shell; run page-health script for live probes.',
}));

const doc = {
  generated_at: new Date().toISOString(),
  product: 'Unified Trading Platform — Forex Admin',
  repository_commit: (() => {
    try {
      return readFileSync(path.join(root, '.git/HEAD'), 'utf8').includes('ref:')
        ? readFileSync(
            path.join(root, '.git', readFileSync(path.join(root, '.git/HEAD'), 'utf8').split(': ')[1]?.trim() ?? ''),
            'utf8',
          ).trim()
        : readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim();
    } catch {
      return 'unknown';
    }
  })(),
  route_count: routes.length,
  nav_groups: groupLabels,
  routes,
  features,
  environments: {
    certification: { admin: '127.0.0.1:3010/admin', api: '127.0.0.1:4100' },
    live_operator: { admin: 'http://109.123.254.30/admin', api: 'http://109.123.254.30/api/v1/admin' },
  },
  external_integrations: {
    lp: 'NOT_CONFIGURED',
    mt4: 'DISABLED',
    mt5: 'DISABLED',
    fix: 'DISABLED',
    ctrader: 'DISABLED',
    real_forex: false,
  },
};

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(JSON.stringify({ ok: true, out, routes: routes.length }));

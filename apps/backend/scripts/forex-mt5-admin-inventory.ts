/**
 * Fresh Forex Admin / MT5-class inventory → .build/forex-mt5-admin-inventory.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, '.build/forex-mt5-admin-inventory.json');

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(path.relative(ROOT, p));
  }
  return out;
}

function countRoutes(file: string): number {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  return (src.match(/app\.(get|post|patch|put|delete)\(/g) ?? []).length;
}

const adminPages = walk(path.join(ROOT, 'apps/admin-panel/src/app/(protected)/forex'), '.tsx');
const navSrc = readFileSync(path.join(ROOT, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts'), 'utf8');
const navRoutes = (navSrc.match(/id: '/g) ?? []).length;

const routeFiles = [
  'apps/backend/src/routes/admin-forex.fastify.ts',
  'apps/backend/src/routes/admin-forex-crm.fastify.ts',
  'apps/backend/src/routes/admin-forex-groups.fastify.ts',
  'apps/backend/src/routes/admin-forex-ops.fastify.ts',
];

const migrateSrc = readFileSync(path.join(ROOT, 'apps/backend/src/database/migrate.ts'), 'utf8');
const forexTables = [...migrateSrc.matchAll(/CREATE TABLE IF NOT EXISTS (forex_[a-z0-9_]+)/gi)].map((m) => m[1]);

const inventory = {
  generated_at: new Date().toISOString(),
  git_sha: process.env.GIT_SHA ?? 'unknown',
  admin_ui: {
    forex_page_files: adminPages.length,
    nav_route_entries: navRoutes,
    pages: adminPages.sort(),
  },
  backend: {
    route_registrations: routeFiles.map((f) => ({ file: f, handler_count: countRoutes(f) })),
    total_handlers: routeFiles.reduce((n, f) => n + countRoutes(f), 0),
  },
  database: {
    forex_table_names: [...new Set(forexTables)].sort(),
    forex_table_count: new Set(forexTables).size,
  },
  e2e: {
    playwright_forex_admin: walk(path.join(ROOT, 'e2e/forex-admin'), '.ts').map((p) => path.relative(ROOT, p)),
    cert_scripts: readdirSync(path.join(ROOT, 'apps/backend/scripts'))
      .filter((f) => f.startsWith('forex-cert') || f.startsWith('forex-mt5'))
      .sort(),
  },
  execution_mode: {
    REAL_FOREX: process.env.REAL_FOREX ?? 'false',
    note: 'MOCK/SIMULATED unless REAL_FOREX explicitly enabled (forbidden in cert)',
  },
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(inventory, null, 2));
console.log('Wrote', OUT);
console.log(JSON.stringify({ pages: inventory.admin_ui.forex_page_files, handlers: inventory.backend.total_handlers, tables: inventory.database.forex_table_count }));

#!/usr/bin/env node
/**
 * Builds .build/I18N_CUSTOMER_SURFACE_MASTER.json with stable surface IDs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const appRoot = path.join(repoRoot, 'apps/frontend/src/app');
const compRoot = path.join(repoRoot, 'apps/frontend/src/components');

const REEXPORT = /export\s+\{\s*default\s*\}\s+from\s+['"](.+?)['"]/;
const MODAL_RE = /(?:Dialog|Modal|Drawer|Sheet|AlertDialog|Popover)/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

function resolveImport(fromFile, importPath) {
  const resolved = path.normalize(path.join(path.dirname(fromFile), importPath));
  for (const c of [`${resolved}.tsx`, `${resolved}/page.tsx`]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function routeUrl(pagePath) {
  const rel = path.relative(appRoot, pagePath).replace(/\/page\.tsx$/, '');
  if (rel === 'page.tsx') return '/';
  return `/${rel}`;
}

const surfaces = [];
let id = 0;

for (const page of walk(appRoot).filter((f) => f.endsWith('page.tsx'))) {
  const src = fs.readFileSync(page, 'utf8');
  const m = src.match(REEXPORT);
  const source = m ? resolveImport(page, m[1]) : page;
  const hasI18n = source ? fs.readFileSync(source, 'utf8').includes('useTranslations') : false;
  surfaces.push({
    id: `ROUTE-${++id}`,
    kind: 'route',
    url: routeUrl(page),
    wrapper: path.relative(repoRoot, page),
    source: source ? path.relative(repoRoot, source) : null,
    reexport: Boolean(m),
    hasUseTranslations: hasI18n,
    status: hasI18n ? 'SOURCE_I18N_WIRED' : 'NEEDS_AUDIT',
  });
}

for (const file of walk(compRoot).filter((f) => f.endsWith('.tsx'))) {
  const base = path.basename(file);
  if (!MODAL_RE.test(base) && !/TransferModal|NotificationCenter|GlobalSearch|ExchangeHeader|PublicHeader|PublicFooter|LanguageSelector/i.test(base)) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  surfaces.push({
    id: `COMP-${++id}`,
    kind: 'shared_component',
    component: path.relative(repoRoot, file),
    hasUseTranslations: content.includes('useTranslations'),
    status: content.includes('useTranslations') ? 'SOURCE_I18N_WIRED' : 'NEEDS_AUDIT',
  });
}

const outJson = path.join(repoRoot, '.build/I18N_CUSTOMER_SURFACE_MASTER.json');
const summary = {
  generatedAt: new Date().toISOString(),
  routeSurfaces: surfaces.filter((s) => s.kind === 'route').length,
  sharedSurfaces: surfaces.filter((s) => s.kind === 'shared_component').length,
  needsAudit: surfaces.filter((s) => s.status === 'NEEDS_AUDIT').length,
  surfaces,
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));

const md = `# Customer surface master

| Metric | Count |
| --- | ---: |
| Route surfaces | ${summary.routeSurfaces} |
| Shared component surfaces | ${summary.sharedSurfaces} |
| NEEDS_AUDIT | ${summary.needsAudit} |

Artifact: \`I18N_CUSTOMER_SURFACE_MASTER.json\`
`;

fs.writeFileSync(path.join(repoRoot, '.build/I18N_CUSTOMER_SURFACE_MASTER.md'), md);
console.log(`Surface master: ${summary.routeSurfaces} routes, ${summary.sharedSurfaces} shared, ${summary.needsAudit} NEEDS_AUDIT`);

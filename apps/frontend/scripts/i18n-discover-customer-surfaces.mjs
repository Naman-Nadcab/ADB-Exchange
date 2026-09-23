#!/usr/bin/env node
/**
 * Customer surface discovery for i18n forensic inventory.
 * Outputs JSON + markdown summary under .build/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const appRoot = path.join(repoRoot, 'apps/frontend/src/app');

const REEXPORT = /export\s+\{\s*default\s*\}\s+from\s+['"](.+?)['"]/;

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === 'page.tsx') acc.push(full);
  }
  return acc;
}

function resolveImport(fromFile, importPath) {
  const resolved = path.normalize(path.join(path.dirname(fromFile), importPath));
  for (const c of [`${resolved}.tsx`, `${resolved}/page.tsx`, `${resolved}.ts`]) {
    if (fs.existsSync(c)) return path.relative(appRoot, c);
  }
  return null;
}

const pages = walk(appRoot);
const routes = [];
const reexports = [];

for (const page of pages) {
  const relRoute = path.relative(appRoot, page).replace(/\/page\.tsx$/, '') || '/';
  const url = relRoute === 'page.tsx' ? '/' : `/${relRoute}`;
  const src = fs.readFileSync(page, 'utf8');
  const m = src.match(REEXPORT);
  const entry = {
    url: url.replace(/\/page$/, ''),
    wrapper: path.relative(appRoot, page),
    kind: m ? 're-export' : 'source',
    source: m ? resolveImport(page, m[1]) : path.relative(appRoot, page),
  };
  routes.push(entry);
  if (m) reexports.push(entry);
}

const outDir = path.join(repoRoot, '.build');
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, 'i18n-customer-route-discovery.json');
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      pageCount: pages.length,
      reexportCount: reexports.length,
      routes,
      reexports,
    },
    null,
    2,
  ),
);

const md = `# Customer route discovery (auto)

| Metric | Count |
| --- | --- |
| page.tsx files | ${pages.length} |
| Re-export wrappers | ${reexports.length} |
| Source pages | ${pages.length - reexports.length} |

Artifact: \`i18n-customer-route-discovery.json\`

## Re-export routes (audit SOURCE component)

${reexports.map((r) => `- \`${r.url}\` → \`${r.source}\``).join('\n')}
`;

fs.writeFileSync(path.join(outDir, 'i18n-customer-route-discovery.md'), md);
console.log(`Wrote ${jsonPath} (${pages.length} pages, ${reexports.length} re-exports)`);

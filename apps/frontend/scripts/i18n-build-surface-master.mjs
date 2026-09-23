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

const REEXPORT =
  /export\s+\{\s*(?:default|\w+\s+as\s+default)\s*\}\s+from\s+['"](.+?)['"]/;
const REDIRECT_ONLY =
  /redirect\s*\(|permanentRedirect\s*\(|Redirect\s*\(|NextResponse\.redirect|export\s+default\s+function\s+\w*\s*\(\s*\)\s*\{\s*redirect\s*\(/;
const MODAL_RE = /(?:Dialog|Modal|Drawer|Sheet|AlertDialog|Popover)/;

function fileUsesI18n(content) {
  return (
    content.includes('useTranslations') ||
    content.includes('getTranslations') ||
    content.includes('useLocale') ||
    /from\s+['"]next-intl['"]/.test(content)
  );
}

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

const frontendSrc = path.join(repoRoot, 'apps/frontend/src');

function resolveModulePath(fromFile, importPath) {
  const base = importPath.startsWith('@/')
    ? path.join(frontendSrc, importPath.slice(2))
    : path.normalize(path.join(path.dirname(fromFile), importPath));
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, 'page.tsx'),
    path.join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Follow re-export / import-default chains to the component that renders UI. */
function resolvePageSource(pageFile, content, depth = 0) {
  if (depth > 8) return pageFile;
  const reexport = content.match(REEXPORT);
  if (reexport) {
    const resolved = resolveModulePath(pageFile, reexport[1]);
    if (resolved && resolved !== pageFile) {
      return resolvePageSource(resolved, fs.readFileSync(resolved, 'utf8'), depth + 1);
    }
  }
  const importDefault = content.match(
    /^import\s+\w+\s+from\s+['"](.+?)['"];?\s*\nexport\s+default\s/m
  );
  if (importDefault) {
    const resolved = resolveModulePath(pageFile, importDefault[1]);
    if (resolved && resolved !== pageFile) {
      return resolvePageSource(resolved, fs.readFileSync(resolved, 'utf8'), depth + 1);
    }
  }
  const WRAPPER_ONLY = new Set(['RequireAuth', 'Suspense', 'Fragment', 'ErrorBoundary', 'Providers']);
  const defaultReturnComp = content.match(
    /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{\s*return\s+<(\w+)\s*\/?>/
  );
  if (defaultReturnComp) {
    const compName = defaultReturnComp[1];
    if (WRAPPER_ONLY.has(compName)) {
      return pageFile;
    }
    const imp = content.match(
      new RegExp(
        `import\\s+(?:\\{[^}]*\\b${compName}\\b[^}]*\\}|${compName})\\s+from\\s+['"](.+?)['"]`
      )
    );
    if (imp) {
      const resolved = resolveModulePath(pageFile, imp[1]);
      if (resolved && resolved !== pageFile) {
        return resolvePageSource(resolved, fs.readFileSync(resolved, 'utf8'), depth + 1);
      }
    }
  }
  const returnEl = content.match(/return\s+<(\w+)\s*\/?>\s*;?\s*\}/);
  if (returnEl) {
    const compName = returnEl[1];
    const imp = content.match(
      new RegExp(`import\\s+\\{[^}]*\\b${compName}\\b[^}]*\\}\\s+from\\s+['"](.+?)['"]`)
    );
    if (imp) {
      const resolved = resolveModulePath(pageFile, imp[1]);
      if (resolved && resolved !== pageFile) {
        return resolvePageSource(resolved, fs.readFileSync(resolved, 'utf8'), depth + 1);
      }
    }
  }
  return pageFile;
}

function isRedirectOnlyPage(content) {
  if (REDIRECT_ONLY.test(content)) return true;
  if (!/router\.(replace|push)\s*\(/m.test(content)) return false;
  if (fileUsesI18n(content)) return false;
  const hasCustomerCopy = /(?:placeholder|title|description|aria-label)=["'`][A-Za-z]{4,}/.test(content);
  const hasVisibleText = />\s*[A-Za-z][^<{]{8,}\s*</.test(content);
  return !hasCustomerCopy && !hasVisibleText;
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
  const source = resolvePageSource(page, src);
  const sourceContent = fs.readFileSync(source, 'utf8');
  const isRedirect = source === page && isRedirectOnlyPage(src);
  const hasI18n = fileUsesI18n(sourceContent);
  let status = 'NEEDS_AUDIT';
  if (isRedirect) status = 'REDIRECT_NO_UI';
  else if (hasI18n) status = 'SOURCE_I18N_WIRED';
  surfaces.push({
    id: `ROUTE-${++id}`,
    kind: 'route',
    url: routeUrl(page),
    wrapper: path.relative(repoRoot, page),
    source: source ? path.relative(repoRoot, source) : null,
    reexport: source !== page,
    redirectOnly: isRedirect,
    hasUseTranslations: hasI18n,
    status,
  });
}

for (const file of walk(compRoot).filter((f) => f.endsWith('.tsx'))) {
  const base = path.basename(file);
  if (!MODAL_RE.test(base) && !/TransferModal|NotificationCenter|GlobalSearch|ExchangeHeader|PublicHeader|PublicFooter|LanguageSelector/i.test(base)) {
    continue;
  }
  const resolvedComp = resolvePageSource(file, fs.readFileSync(file, 'utf8'));
  const content = fs.readFileSync(resolvedComp, 'utf8');
  const hasI18n = fileUsesI18n(content);
  surfaces.push({
    id: `COMP-${++id}`,
    kind: 'shared_component',
    component: path.relative(repoRoot, file),
    source: resolvedComp !== file ? path.relative(repoRoot, resolvedComp) : null,
    hasUseTranslations: hasI18n,
    status: hasI18n ? 'SOURCE_I18N_WIRED' : 'NEEDS_AUDIT',
  });
}

const outJson = path.join(repoRoot, '.build/I18N_CUSTOMER_SURFACE_MASTER.json');
const summary = {
  generatedAt: new Date().toISOString(),
  routeSurfaces: surfaces.filter((s) => s.kind === 'route').length,
  sharedSurfaces: surfaces.filter((s) => s.kind === 'shared_component').length,
  needsAudit: surfaces.filter((s) => s.status === 'NEEDS_AUDIT').length,
  redirectNoUi: surfaces.filter((s) => s.status === 'REDIRECT_NO_UI').length,
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

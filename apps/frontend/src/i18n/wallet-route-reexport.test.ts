/**
 * Ensures wallet (and orders) route re-exports resolve to real page modules.
 * Prevents audits that only scan wallet route wrappers from missing dashboard sources.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    console.error(`fail ${name}`, e);
    process.exitCode = 1;
  }
}

const appRoot = path.join(__dirname, '../../src/app');

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === 'page.tsx') acc.push(full);
  }
  return acc;
}

const REEXPORT = /export\s+\{\s*default\s*\}\s+from\s+['"](.+?)['"]/;

test('wallet and orders re-export targets exist on disk', () => {
  const pages = walk(appRoot);
  const reexports: { from: string; to: string }[] = [];

  for (const page of pages) {
    const rel = path.relative(appRoot, page);
    if (!rel.startsWith('wallet/') && !rel.startsWith('orders/')) continue;
    const src = fs.readFileSync(page, 'utf8');
    const m = src.match(REEXPORT);
    if (!m) continue;
    const importPath = m[1];
    const resolved = path.normalize(path.join(path.dirname(page), importPath));
    const candidates = [`${resolved}.tsx`, `${resolved}/page.tsx`, `${resolved}.ts`];
    const hit = candidates.find((c) => fs.existsSync(c));
    assert.ok(hit, `re-export broken: ${rel} -> ${importPath} (tried ${candidates.join(', ')})`);
    reexports.push({ from: rel, to: path.relative(appRoot, hit!) });
  }

  assert.ok(reexports.length >= 8, `expected multiple wallet re-exports, found ${reexports.length}`);
});

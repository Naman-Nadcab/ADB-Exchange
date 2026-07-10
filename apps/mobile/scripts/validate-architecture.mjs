#!/usr/bin/env node
/**
 * Architecture validation — MOB-001C folder structure & import rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredDirs = [
  'app/providers',
  'app/navigation',
  'app/bootstrap',
  'features/auth',
  'features/trade',
  'features/wallet',
  'features/p2p',
  'core/api',
  'core/ws',
  'core/storage',
  'shared/theme',
  'tests/unit',
  'e2e/auth',
];

let failed = 0;
for (const dir of requiredDirs) {
  const p = path.join(root, dir);
  if (!fs.existsSync(p)) {
    console.error(`MISSING: ${dir}`);
    failed++;
  }
}

const forbiddenImports = [];
function scanTs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scanTs(p);
    else if (/\.tsx?$/.test(ent.name)) {
      const text = fs.readFileSync(p, 'utf8');
      if (/from '@features\/[^/]+\/screens/.test(text)) forbiddenImports.push(p);
      if (path.relative(path.join(root, 'core'), p).startsWith('..') === false) {
        if (/from '@features\//.test(text)) forbiddenImports.push(p);
      }
    }
  }
}

scanTs(path.join(root, 'core'));
scanTs(path.join(root, 'shared'));

if (forbiddenImports.length) {
  console.error('Import boundary violations:', forbiddenImports);
  failed += forbiddenImports.length;
}

if (failed) {
  console.error(`Architecture validation FAILED (${failed})`);
  process.exit(1);
}
console.log('Architecture validation PASSED');

#!/usr/bin/env node
/**
 * Heuristic customer-facing English literal scan (frontend app + components).
 * Every hit requires classification in I18N_HARDCODED_STRING_CLASSIFICATION.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const roots = [
  path.join(repoRoot, 'apps/frontend/src/app'),
  path.join(repoRoot, 'apps/frontend/src/components'),
  path.join(repoRoot, 'apps/frontend/src/features'),
].filter((r) => fs.existsSync(r));

const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__']);
const EXT = new Set(['.tsx', '.ts', '.jsx', '.js']);

const JSX_TEXT = />\s*([A-Za-z][A-Za-z0-9 ,.'’!?&:/–—-]{2,80})\s*</g;
const ATTR =
  /(?:aria-label|title|placeholder|alt)\s*=\s*["']([A-Za-z][^"']{2,120})["']/g;
const STRING_LITERAL = /["']([A-Z][a-z]+(?: [A-Za-z0-9][^"']{1,80})?)["']/g;

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (EXT.has(path.extname(ent.name))) acc.push(full);
  }
  return acc;
}

function isLikelyCustomer(text) {
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^(BTC|ETH|USDT|USDC|API|URL|HTTP|GTC|IOC|FOK|SMA|EMA|RSI|USD|EUR)$/i.test(t)) return false;
  if (/^[0-9]+[mhdD]$/.test(t)) return false;
  if (/^use[A-Z]/.test(t)) return false;
  if (t.includes('className') || t.includes('http')) return false;
  return /[a-z]/.test(t) && /[A-Za-z]{3,}/.test(t);
}

const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const rel = path.relative(repoRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('useTranslations') && !content.match(/>[A-Za-z]/)) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.includes('useTranslations(')) continue;
      for (const re of [JSX_TEXT, ATTR]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          const text = m[1].trim();
          if (isLikelyCustomer(text)) {
            hits.push({ file: rel, line: i + 1, kind: re === JSX_TEXT ? 'jsx' : 'attr', text });
          }
        }
      }
    }
  }
}

const uniq = [];
const seen = new Set();
for (const h of hits) {
  const k = `${h.file}:${h.text}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(h);
}

const out = path.join(repoRoot, '.build/i18n-hardcoded-forensic-scan.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: uniq.length,
      hits: uniq,
    },
    null,
    2,
  ),
);
console.log(`Scan complete: ${uniq.length} heuristic hits → ${out}`);

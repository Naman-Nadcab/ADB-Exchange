/**
 * Pass-3 gap register with marker triage (filters false positives).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, '.build/forex-pass3-gap-register.json');

const STRONG = /\b(TODO|FIXME|NOT_IMPLEMENTED|COMING SOON|not implemented)\b/i;
const WEAK = /\b(PARTIAL|NOT_CONNECTED|PLACEHOLDER|FUTURE|STUB)\b/i;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

function classify(file: string, line: string): string {
  const rel = path.relative(ROOT, file);
  if (/\.test\.(ts|tsx)$/.test(rel) || /\.spec\.(ts|tsx)$/.test(rel)) return 'TEST_FIXTURE';
  if (/Partial<|partial\.|partial /i.test(line)) return 'FALSE_POSITIVE_TYPESCRIPT';
  if (/placeholder=/i.test(line) && /Input|placeholder/i.test(line)) return 'FALSE_POSITIVE_UI_INPUT';
  if (/NOT_CONNECTED|NOT_CONFIGURED|NOT_AVAILABLE/i.test(line)) return 'LEGITIMATE_EXTERNAL_OR_MOCK_STATE';
  if (/MOCK|SIMULATED/i.test(line)) return 'LEGITIMATE_MOCK';
  if (STRONG.test(line)) return 'REQUIRED_IMPLEMENTATION';
  if (WEAK.test(line)) return 'REVIEW_REQUIRED';
  return 'UNCLASSIFIED';
}

const bases = [
  path.join(ROOT, 'apps/backend/src/services/forex'),
  path.join(ROOT, 'apps/backend/src/routes'),
  path.join(ROOT, 'apps/admin-panel/src/components/forex'),
  path.join(ROOT, 'apps/admin-panel/src/app/(protected)/forex'),
];

const hits: Array<{ file: string; line: number; text: string; classification: string }> = [];
for (const base of bases) {
  try {
    for (const file of walk(base)) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, i) => {
        if (!STRONG.test(text) && !WEAK.test(text)) return;
        hits.push({ file: rel, line: i + 1, text: text.trim().slice(0, 240), classification: classify(file, text) });
      });
    }
  } catch {
    /* skip */
  }
}

const required = hits.filter((h) => h.classification === 'REQUIRED_IMPLEMENTATION' || h.classification === 'REVIEW_REQUIRED');

const register = {
  generated_at: new Date().toISOString(),
  summary: {
    total_marker_hits: hits.length,
    required_or_review: required.length,
    false_positives: hits.filter((h) => h.classification.startsWith('FALSE')).length,
    legitimate_mock: hits.filter((h) => h.classification.includes('MOCK') || h.classification.includes('EXTERNAL')).length,
  },
  required_gaps: [
    { id: 'CRYPTO-STAGING-FULL', domain: 'CRYPTO', status: 'BLOCKED', severity: 'P0' },
    { id: 'EXT-LP-LIVE', domain: 'INTEGRATIONS', status: 'EXTERNALLY_DEPENDENT', severity: 'P0' },
    { id: 'IB-EXTERNAL-PAYOUT', domain: 'IB', status: 'EXTERNALLY_DEPENDENT', severity: 'P1' },
    ...required.slice(0, 50).map((h, i) => ({
      id: `MARKER-${i + 1}`,
      domain: 'FOREX',
      file: h.file,
      line: h.line,
      classification: h.classification,
      status: 'OPEN',
    })),
  ],
  hits_sample: hits.slice(0, 100),
  completion_gate: { required_gaps_zero: false },
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(register, null, 2));
console.log(JSON.stringify(register.summary));

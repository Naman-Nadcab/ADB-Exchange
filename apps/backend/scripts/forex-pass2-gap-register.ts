/**
 * Pass-2 gap register — scans repo markers + inventory deltas.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, '.build/forex-complete-gap-register.json');
const MARKERS = /\b(TODO|FIXME|PARTIAL|NOT_IMPLEMENTED|PLACEHOLDER|COMING SOON|not implemented)\b/gi;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx|md)$/.test(name)) acc.push(p);
  }
  return acc;
}

const forexPaths = [
  path.join(ROOT, 'apps/backend/src/services/forex'),
  path.join(ROOT, 'apps/backend/src/routes/admin-forex'),
  path.join(ROOT, 'apps/admin-panel/src/components/forex'),
  path.join(ROOT, 'apps/admin-panel/src/app/(protected)/forex'),
];

const hits: Array<{ file: string; line: number; text: string }> = [];
for (const base of forexPaths) {
  try {
    for (const file of walk(base)) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (MARKERS.test(line)) {
          hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 200) });
        }
        MARKERS.lastIndex = 0;
      });
    }
  } catch {
    /* missing path */
  }
}

const requiredGaps = [
  {
    id: 'FIN-LEDGER-EXEC',
    domain: 'FINANCE',
    feature: 'Approved finance request ledger post',
    current_state: 'IMPLEMENTED_PASS2',
    severity: 'P0',
    status: 'VERIFY_E2E',
  },
  {
    id: 'EXT-LP-MT5',
    domain: 'INTEGRATIONS',
    feature: 'Live MT5/FIX/cTrader/LP connectivity',
    current_state: 'NOT_CONFIGURED',
    severity: 'P0',
    status: 'EXTERNALLY_DEPENDENT',
    required_to_complete: 'REAL_FOREX gate + credentials — out of cert scope',
  },
  {
    id: 'CRYPTO-FULL-E2E',
    domain: 'CRYPTO',
    feature: 'Full staging regression ph3-15',
    current_state: 'BLOCKED',
    severity: 'P0',
    status: 'BLOCKED_NO_STAGING',
  },
  {
    id: 'IB-PAYOUT-RAIL',
    domain: 'IB',
    feature: 'External payout rail execution',
    current_state: 'INTERNAL_ONLY',
    severity: 'P1',
    status: 'EXTERNALLY_DEPENDENT',
  },
];

const register = {
  generated_at: new Date().toISOString(),
  marker_hits: hits,
  marker_hit_count: hits.length,
  required_gaps: requiredGaps,
  completion_gate: {
    partial_zero_claim: false,
    note: 'Pass-2 closed FIN-LEDGER-EXEC; external LP and full Crypto staging remain',
  },
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(register, null, 2));
writeFileSync(path.join(ROOT, '.build/forex-complete-build-inventory.json'), readFileSync(path.join(ROOT, '.build/forex-mt5-admin-inventory.json'), 'utf8'));
console.log(JSON.stringify({ markers: hits.length, gaps: requiredGaps.length, out: OUT }));

#!/usr/bin/env node
/**
 * Runtime certification coverage aggregator (release gate >=95%).
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'audit', 'runtime-coverage.json');

const gates = [
  { id: 'regression_1000', label: '1000× trading invariants', weight: 2 },
  { id: 'trading_invariants', label: 'Trading invariants', weight: 1 },
  { id: 'financial_integrity', label: 'Financial integrity', weight: 2 },
  { id: 'deposit', label: 'Deposit (RC-005 P4)', weight: 1 },
  { id: 'withdraw', label: 'Withdraw (RC-005 P5)', weight: 1 },
  { id: 'internal_transfer', label: 'Internal transfer (RC-005 P6)', weight: 1 },
  { id: 'p2p_full', label: 'P2P escrow/release/dispute', weight: 2 },
  { id: 'wallet_api', label: 'Wallet API phases', weight: 1 },
  { id: 'security', label: 'Security suite', weight: 2 },
  { id: 'admin_maker_checker', label: 'Admin maker-checker', weight: 1 },
  { id: 'ui_responsive', label: 'UI responsive (712)', weight: 2 },
  { id: 'a11y_smoke', label: 'Accessibility smoke', weight: 1 },
  { id: 'soak', label: 'Soak test', weight: 1 },
  { id: 'performance', label: 'Performance load gate', weight: 1 },
  { id: 'spot_cross', label: 'Spot cross-trade E2E', weight: 1 },
];

function gateFromLog(path, passPattern) {
  if (!existsSync(path)) return 'MISSING';
  const t = readFileSync(path, 'utf8');
  return passPattern.test(t) ? 'PASS' : t.includes('FAIL') ? 'FAIL' : 'UNKNOWN';
}

/** @type {Record<string, string>} */
const status = {};

status.regression_1000 = gateFromLog(join(ROOT, 'audit/regression-1000.log'), /"pass":\s*true/);
status.trading_invariants = gateFromLog(join(ROOT, 'audit/final-cert-trading-invariants.log'), /"allPass":\s*true/);
status.financial_integrity = gateFromLog(join(ROOT, 'audit/final-cert-financial.log'), /^PASS:/m);
status.deposit = existsSync(join(ROOT, 'docs/production-closure/RC-005-PHASE4-DEPOSIT-REPORT.md'))
  ? (readFileSync(join(ROOT, 'docs/production-closure/RC-005-PHASE4-DEPOSIT-REPORT.md'), 'utf8').includes('Verdict:** PASS') ? 'PASS' : 'FAIL')
  : 'MISSING';
status.withdraw = existsSync(join(ROOT, 'docs/production-closure/RC-005-PHASE5-WITHDRAWAL-REPORT.md'))
  ? (readFileSync(join(ROOT, 'docs/production-closure/RC-005-PHASE5-WITHDRAWAL-REPORT.md'), 'utf8').includes('Verdict:** PASS') ? 'PASS' : 'FAIL')
  : 'MISSING';
status.internal_transfer = existsSync(join(ROOT, 'docs/production-closure/RC-005-PHASE6-TRANSFER-REPORT.md'))
  ? (readFileSync(join(ROOT, 'docs/production-closure/RC-005-PHASE6-TRANSFER-REPORT.md'), 'utf8').includes('Verdict:** PASS') ? 'PASS' : 'FAIL')
  : 'MISSING';

const p7 = existsSync(join(ROOT, 'docs/production-closure/RC-005-PHASE7-P2P-REPORT.md'))
  ? readFileSync(join(ROOT, 'docs/production-closure/RC-005-PHASE7-P2P-REPORT.md'), 'utf8')
  : '';
status.p2p_full = p7.includes('Verdict:** PASS')
  ? 'PASS'
  : p7.includes('EXTERNAL_DEPENDENCY')
    ? 'EXTERNAL'
    : p7.includes('FAIL')
      ? 'FAIL'
      : 'MISSING';

status.wallet_api = gateFromLog(join(ROOT, 'audit/final-cert-e2e-wallet.log'), /Total:.*0 failed/);
status.security = gateFromLog(join(ROOT, 'audit/final-cert-security.log'), /Total:.*0 failed/);
status.admin_maker_checker = gateFromLog(join(ROOT, 'audit/final-cert-admin.log'), /PASS: approval policies/);
status.ui_responsive = gateFromLog(join(ROOT, 'audit/final-cert-ui.log'), /712 passed/);
status.a11y_smoke = gateFromLog(join(ROOT, 'audit/final-cert-a11y.log'), /0 failed/);
status.soak = gateFromLog(join(ROOT, 'audit/final-cert-soak.log'), /SOAK_COMPLETE/);
status.performance = gateFromLog(join(ROOT, 'audit/final-cert-performance.log'), /LOAD_GATE_OK/);
status.spot_cross = gateFromLog(join(ROOT, 'audit/final-cert-phase3.log'), /0 failed/);

let external = [];
try {
  external = JSON.parse(readFileSync(join(ROOT, 'audit/final-cert-external-blockers.json'), 'utf8')).all ?? [];
} catch {
  external = [];
}

let totalWeight = 0;
let executedWeight = 0;
let passWeight = 0;

const rows = gates.map((g) => {
  const s = status[g.id] ?? 'MISSING';
  totalWeight += g.weight;
  if (s !== 'MISSING' && s !== 'UNKNOWN') executedWeight += g.weight;
  if (s === 'PASS') passWeight += g.weight;
  if (s === 'EXTERNAL') executedWeight += g.weight;
  return { ...g, status: s };
});

const executedPct = totalWeight ? (executedWeight / totalWeight) * 100 : 0;
const passPct = totalWeight ? (passWeight / totalWeight) * 100 : 0;
const threshold = 95;
const met = executedPct >= threshold;

const report = {
  generatedAt: new Date().toISOString(),
  threshold_pct: threshold,
  executed_pct: Math.round(executedPct * 10) / 10,
  strict_pass_pct: Math.round(passPct * 10) / 10,
  met,
  gates: rows,
  externalBlockers: external,
};

mkdirSync(join(ROOT, 'audit'), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(met ? 0 : 1);

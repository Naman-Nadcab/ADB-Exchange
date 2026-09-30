#!/usr/bin/env node
/**
 * Phase 0 / 32 / 35 — Forex MT5 parity baseline, execution matrix, final snapshot.
 * Run: node scripts/forex-mt5-parity-program.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.join(root, '.build');

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const commit = sh('git rev-parse HEAD');
const branch = sh('git rev-parse --abbrev-ref HEAD');
const ts = new Date().toISOString();

const cryptoSpot = sh('sha256sum apps/backend/src/routes/spot.fastify.ts').split(/\s+/)[0] ?? '';
const cryptoTicker = sh('sha256sum apps/backend/src/lib/spot-ticker-db-load.ts').split(/\s+/)[0] ?? '';

const realForex = process.env.REAL_FOREX ?? '(container env — verify at deploy)';

const executionMatrix = {
  generatedAtUtc: ts,
  commit,
  executionMode: 'MOCK',
  realForex: false,
  source: 'SIMULATED',
  modes: {
    marketExecution: { mt5: true, engine: 'MOCK instant fill at quote', customerUi: true, status: 'YELLOW', note: 'MOCK semantics — not LP Request/Instant' },
    instantExecution: { mt5: true, engine: false, customerUi: false, status: 'NOT_CONFIGURED' },
    requestExecution: { mt5: true, engine: false, customerUi: false, status: 'NOT_CONFIGURED' },
    exchangeExecution: { mt5: true, engine: false, customerUi: false, status: 'NOT_CONFIGURED' },
  },
  fillPolicies: {
    FOK: { engine: true, customerExposed: true, status: 'YELLOW' },
    IOC: { engine: true, customerExposed: true, status: 'YELLOW' },
    RETURN: { engine: false, customerExposed: false, status: 'NOT_CONFIGURED' },
    BOC: { engine: false, customerExposed: false, status: 'NOT_CONFIGURED' },
  },
  timeInForce: {
    GTC: { engine: true, customerExposed: true, status: 'YELLOW' },
    DAY: { engine: true, customerExposed: true, status: 'YELLOW' },
    IOC: { engine: true, customerExposed: true, status: 'YELLOW' },
    FOK: { engine: true, customerExposed: true, status: 'YELLOW' },
    GTD: { engine: false, customerExposed: false, status: 'RED', note: 'Not in FOREX_ENGINE_TIME_IN_FORCE' },
  },
  providerGate: 'REAL_FOREX off — no live LP execution certification',
};

const parityRows = [
  { capability: '8 order types (side × kind)', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Live fill/trigger MARKET_DEPENDENT' },
  { capability: 'Chart trading (8 paths)', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Live session cert' },
  { capability: 'Pending chart price drag → modify', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Browser + market modify cert' },
  { capability: 'Netting / Hedging', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Hedging runtime multi-position MARKET_DEPENDENT' },
  { capability: 'Position mode switch UI', mt5: 'GREEN', ours: 'GREEN', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Flat-account guard verified in code' },
  { capability: 'SL/TP + trailing', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Trigger MARKET_DEPENDENT' },
  { capability: 'Close / partial / Close By', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'Close By hedging runtime' },
  { capability: 'History CSV export', mt5: 'GREEN', ours: 'YELLOW', backend: 'GREEN', frontend: 'GREEN', status: 'YELLOW', gap: 'XLSX/PDF roadmap' },
  { capability: 'DOM', mt5: 'GREEN', ours: 'BLUE', backend: 'RED', frontend: 'BLUE', status: 'BLUE', gap: 'PROVIDER_DEPENDENT depth — UI explicit unavailable' },
  { capability: 'Time & Sales', mt5: 'GREEN', ours: 'BLUE', backend: 'RED', frontend: 'BLUE', status: 'BLUE', gap: 'No authoritative trade tape' },
  { capability: 'Server alerts', mt5: 'GREEN', ours: 'ORANGE', backend: 'RED', frontend: 'ORANGE', status: 'ORANGE', gap: 'Local-only disclosed; architecture roadmap' },
  { capability: 'Command palette (Forex)', mt5: 'partial', ours: 'ORANGE', backend: 'n/a', frontend: 'ORANGE', status: 'ORANGE', gap: 'Global search only — Forex command center roadmap' },
  { capability: 'MOCK execution disclosure', mt5: 'n/a', ours: 'GREEN', backend: 'GREEN', frontend: 'GREEN', status: 'GREEN', gap: 'None' },
];

const baseline = {
  phase: 0,
  title: 'Forex MT5 parity forensic baseline',
  branch,
  commit,
  generatedAtUtc: ts,
  realForex,
  cryptoIsolation: { spotFastifySha256: cryptoSpot, spotTickerDbLoadSha256: cryptoTicker },
  customerSurface: '/forex/trade',
  authoritativeTrace: {
    contract: 'apps/backend/src/services/forex/capabilities/customer-contract.ts',
    config: 'GET /api/v1/forex/trading-config',
    orders: 'apps/backend/src/services/forex/orders/service.ts',
    positions: 'apps/backend/src/services/forex/positions/service.ts',
    protections: 'apps/backend/src/services/forex/protection/service.ts',
    ws: 'apps/backend/src/services/forex/ws',
    ledger: 'apps/backend/src/services/forex/ledger',
  },
  implementationHighlights: [
    'Order ticket: BUY/SELL + MARKET/LIMIT/STOP/STOP LIMIT labels',
    'Chart context menu: 8 order drafts → shared ticket draft',
    'Chart pending drag → POST order modify (requestedPrice / limitPrice)',
    'Position mode switch modal + PENDING_ORDERS backend guard',
    'DOM / news / calendar: explicit unavailable or provider-backed only',
  ],
  parityRows,
};

const finalReport = {
  phase: 35,
  title: 'Forex MT5 parity+ program snapshot',
  branch,
  commit,
  generatedAtUtc: ts,
  executiveStatus: 'PARTIALLY_MT5_CLASS — pre-market implementation pass; live GREEN not claimed',
  classification: {
    implementedVerified: ['Crypto isolation fingerprints', 'REAL_FOREX off', '8 order type discoverability', 'DOM not faked'],
    implementedMarketDependent: ['Fills', 'Pending triggers', 'SL/TP/trailing triggers', 'Live uPnL/margin'],
    implementedProviderDependent: ['DOM depth', 'Time & Sales tape', 'Live news/calendar when provider empty'],
    implementationGaps: ['GTD', 'Server-backed customer alerts', 'Forex-dedicated command palette', 'XLSX/PDF export'],
    productRoadmap: ['AI assistants', 'Strategy builder', 'Cloud workspace sync'],
  },
  artifacts: [
    '.build/forex-mt5-parity-baseline.json',
    '.build/forex-execution-capability-matrix.json',
    '.build/forex-mt5-parity-final.json',
    '.build/forex-pre-market-cert.json',
    '.build/forex-pre-market-browser.json',
  ],
  parityRows,
  executionMatrix,
};

fs.mkdirSync(build, { recursive: true });
fs.writeFileSync(path.join(build, 'forex-mt5-parity-baseline.json'), JSON.stringify(baseline, null, 2));
fs.writeFileSync(path.join(build, 'forex-execution-capability-matrix.json'), JSON.stringify(executionMatrix, null, 2));
fs.writeFileSync(path.join(build, 'forex-mt5-parity-final.json'), JSON.stringify(finalReport, null, 2));

const md = (title, body) =>
  `# ${title}\n\nGenerated: ${ts}\nCommit: \`${commit}\`\nBranch: \`${branch}\`\n\n${body}\n`;

fs.writeFileSync(
  path.join(build, 'forex-mt5-parity-baseline.md'),
  md(
    'Forex MT5 parity baseline (Phase 0)',
    `## Crypto isolation\n- spot.fastify.ts \`${cryptoSpot}\`\n- spot-ticker-db-load.ts \`${cryptoTicker}\`\n\n## Parity rows\n${parityRows.map((r) => `- **${r.capability}**: ${r.status} — ${r.gap}`).join('\n')}\n`
  )
);
fs.writeFileSync(
  path.join(build, 'forex-mt5-parity-final.md'),
  md(
    'Forex MT5 parity+ final report (Phase 35 snapshot)',
    `## Executive status\n${finalReport.executiveStatus}\n\n## Implemented this pass\n- Chart pending order drag → server modify\n- Hedging/netting mode switch UI (flat account + pending guard)\n- Execution capability matrix artifact\n\n## Remaining runtime certification\n- \`node scripts/forex-phase4-live-green-cert.mjs\` when session open\n- \`node scripts/forex-browser-cert.mjs\`\n`
  )
);

console.log('Wrote forex-mt5-parity-baseline, execution-capability-matrix, forex-mt5-parity-final');

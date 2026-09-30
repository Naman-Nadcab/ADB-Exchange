#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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
const ts = new Date().toISOString();

const gaps = [
  { id: 'order-model', class: 'A', status: 'GREEN', note: 'side_x_kind + trading-config orderKinds/paths' },
  { id: 'gtd', class: 'A', status: 'GREEN', note: 'GTD + expireAt + expireGtdOrders' },
  { id: 'execution-resolver', class: 'A', status: 'GREEN', note: 'resolveForexExecutionCapabilities' },
  { id: 'server-alerts-foundation', class: 'A', status: 'YELLOW', note: 'DB + CRUD + quote evaluator; push/email gated' },
  { id: 'command-center', class: 'A', status: 'GREEN', note: 'Forex ⌘/Ctrl+K on /forex' },
  { id: 'tape-architecture', class: 'E', status: 'BLUE', note: 'UI + provider contract; no fake tape' },
  { id: 'dom-architecture', class: 'E', status: 'BLUE', note: 'Explicit unavailable + provider hook' },
  { id: 'timeframes-full-mt5', class: 'F', status: 'ORANGE', note: 'Registry lists all; only verified TFs customerSupported' },
  { id: 'indicators-full-mt5', class: 'F', status: 'ORANGE', note: 'Subset live; registry roadmap' },
  { id: 'drawings-full-mt5', class: 'F', status: 'ORANGE', note: 'Existing engine; expansion roadmap' },
  { id: 'live-fills', class: 'D', status: 'YELLOW', note: 'MARKET_DEPENDENT' },
];

const register = { generatedAtUtc: ts, commit, gaps };
const finalDoc = {
  generatedAtUtc: ts,
  commit,
  executiveStatus: 'P0/P1 non-market gaps addressed; live runtime still MARKET_DEPENDENT',
  gaps,
  tests: [
    'customer-contract.test.ts',
    'order-paths.test.ts',
    'forex-gtd.test.ts',
    'forex-phase2-customer-terminal.test.ts',
    'forex-phase1a-hedging.test.ts',
    'trailing.test.ts',
  ],
};

fs.mkdirSync(build, { recursive: true });
fs.writeFileSync(path.join(build, 'forex-p0-p1-gap-register.json'), JSON.stringify(register, null, 2));
fs.writeFileSync(path.join(build, 'forex-p0-p1-final.json'), JSON.stringify(finalDoc, null, 2));
fs.writeFileSync(
  path.join(build, 'forex-p0-p1-gap-register.md'),
  `# Forex P0/P1 gap register\n\n${gaps.map((g) => `- **${g.id}** (${g.class}) → ${g.status}: ${g.note}`).join('\n')}\n`
);
fs.writeFileSync(
  path.join(build, 'forex-p0-p1-final.md'),
  `# Forex P0/P1 final\n\nCommit \`${commit}\`\n\n${finalDoc.executiveStatus}\n`
);
console.log('Wrote forex-p0-p1-gap-register and forex-p0-p1-final');

#!/usr/bin/env node
/**
 * Phase 4 — Aggregate all verification reports into production readiness certification.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs', 'production-closure');
mkdirSync(OUT, { recursive: true });

function loadReport(path, key = 'verdict') {
  const jsonPath = join(path, 'report.json');
  const matrixPath = join(path, 'matrix.json');
  if (existsSync(jsonPath)) {
    try {
      const j = JSON.parse(readFileSync(jsonPath, 'utf8'));
      return { path, verdict: j.verdict ?? (j.passed === j.total ? 'PASS' : 'FAIL'), detail: j };
    } catch {
      return { path, verdict: 'UNKNOWN', detail: null };
    }
  }
  if (existsSync(matrixPath)) {
    try {
      const j = JSON.parse(readFileSync(matrixPath, 'utf8'));
      return { path, verdict: j.verdict ?? 'UNKNOWN', detail: j };
    } catch {
      return { path, verdict: 'UNKNOWN', detail: null };
    }
  }
  return { path, verdict: 'MISSING', detail: null };
}

function gitStatus() {
  try {
    return execSync('git status --porcelain', { encoding: 'utf8', cwd: ROOT }).trim();
  } catch {
    return '';
  }
}

const suites = [
  { name: 'Playwright Admin Sweep', dir: 'docs/verification-admin-sweep', classify: 'BLOCKER' },
  { name: 'Matching Engine Durability', dir: 'docs/verification-match-engine', classify: 'BLOCKER' },
  { name: 'Matching Engine Load Test', dir: 'docs/verification-match-load', classify: 'BLOCKER' },
  { name: 'Financial Integrity', dir: 'docs/verification-financial', classify: 'BLOCKER' },
  { name: 'Infrastructure', dir: 'docs/verification-infrastructure', classify: 'BLOCKER' },
  { name: 'Realtime Verification', dir: 'docs/verification-realtime', classify: 'WARNING' },
  { name: 'Alert Center', dir: 'docs/verification-alerts', classify: 'WARNING' },
  { name: 'Monitoring Controls', dir: 'docs/verification-controls', classify: 'WARNING' },
];

const results = suites.map((s) => {
  const r = loadReport(join(ROOT, s.dir));
  let classification = r.verdict;
  if (r.verdict === 'FAIL' && s.classify === 'BLOCKER') classification = 'BLOCKER';
  else if (r.verdict === 'FAIL') classification = 'FAIL';
  else if (r.verdict === 'WARNING') classification = 'WARNING';
  else if (r.verdict === 'MISSING') classification = 'BLOCKER';
  return { ...s, ...r, classification };
});

const blockers = results.filter((r) => r.classification === 'BLOCKER');
const critical = results.filter((r) => r.classification === 'FAIL');
const warnings = results.filter((r) => r.classification === 'WARNING');
const passed = results.filter((r) => r.classification === 'PASS');

const overall =
  blockers.length > 0 ? 'NO-GO' :
  critical.length > 0 ? 'NO-GO' :
  warnings.length > 0 ? 'CONDITIONAL-GO' :
  'GO';

const certification = {
  generatedAt: new Date().toISOString(),
  overall,
  releaseTag: overall === 'GO' || overall === 'CONDITIONAL-GO' ? 'v1.0.0-production-ready' : null,
  commitAllowed: blockers.length === 0 && critical.length === 0,
  summary: { pass: passed.length, warning: warnings.length, fail: critical.length, blocker: blockers.length },
  suites: results.map(({ name, verdict, classification, path }) => ({ name, verdict, classification, evidence: path })),
  gitDirty: gitStatus().length > 0,
  gitStatusPreview: gitStatus().split('\n').slice(0, 20),
};

writeFileSync(join(OUT, 'certification.json'), JSON.stringify(certification, null, 2));

const md = [
  '# Production Readiness Report',
  '',
  `Generated: ${certification.generatedAt}`,
  '',
  `## Overall: **${overall}**`,
  '',
  certification.commitAllowed
    ? 'Release commit permitted (no BLOCKER/CRITICAL).'
    : '**DO NOT COMMIT** — blockers remain. See remediation below.',
  '',
  '## Suite Matrix',
  '',
  '| Suite | Verdict | Classification | Evidence |',
  '|-------|---------|----------------|----------|',
  ...results.map((r) => `| ${r.name} | ${r.verdict} | ${r.classification} | ${r.path} |`),
  '',
  '## Blockers',
  blockers.length ? blockers.map((b) => `- ${b.name}: ${b.verdict}`).join('\n') : '_None_',
  '',
  '## Warnings',
  warnings.length ? warnings.map((w) => `- ${w.name}: ${w.verdict}`).join('\n') : '_None_',
  '',
  '## Release Artifacts (if GO)',
  '- Tag: `v1.0.0-production-ready`',
  '- See `RELEASE_NOTES.md`, `ROLLBACK_PLAN.md`, `DEPLOYMENT_CHECKLIST.md`',
  '',
].join('\n');

writeFileSync(join(OUT, 'PRODUCTION_READINESS.md'), md);

if (certification.commitAllowed) {
  writeFileSync(
    join(OUT, 'RELEASE_NOTES.md'),
    `# v1.0.0-production-ready\n\nInternal production hardening release.\n\n- Backend single source of truth for alerts, incidents, audit\n- Matching engine backpressure + WAL/JetStream durability\n- Session-local admin UI disabled under production hardening\n- Full verification suite evidence in docs/\n`,
  );
  writeFileSync(
    join(OUT, 'ROLLBACK_PLAN.md'),
    `# Rollback Plan\n\n1. \`git checkout <previous-tag>\`\n2. \`docker compose -f docker-compose.production.yml up -d --build\`\n3. Verify \`/health\` and admin login\n4. Run \`scripts/run-production-closure.sh\` smoke subset\n`,
  );
  writeFileSync(
    join(OUT, 'DEPLOYMENT_CHECKLIST.md'),
    `# Deployment Checklist\n\n- [ ] Migrations applied\n- [ ] \`ADMIN_PRODUCTION_HARDENING=true\` in admin build\n- [ ] Matching engine WAL + NATS healthy\n- [ ] No open BLOCKER in certification.json\n- [ ] Financial integrity PASS\n`,
  );
}

console.log(JSON.stringify(certification, null, 2));
console.log(`\nReport: ${join(OUT, 'PRODUCTION_READINESS.md')}`);
process.exit(blockers.length > 0 || critical.length > 0 ? 1 : 0);

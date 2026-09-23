#!/usr/bin/env node
/** Summarize Playwright JSONL runtime results into .build/I18N_RUNTIME_SURFACE_REPORT.md */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const jsonl = path.join(repoRoot, '.build/i18n-deep-forensic-rendered-results.jsonl');
const outJson = path.join(repoRoot, '.build/i18n-runtime-surface-results.json');

if (!fs.existsSync(jsonl)) {
  console.error('No runtime jsonl yet:', jsonl);
  process.exit(0);
}

const lines = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean);
const rows = lines.map((l) => JSON.parse(l));
const pass = rows.filter((r) => r.result === 'PASS').length;
const fail = rows.length - pass;

fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, pass, fail, rows }, null, 2));

const md = `# I18n runtime surface report

| Metric | Count |
| --- | ---: |
| Total checks | ${rows.length} |
| PASS | ${pass} |
| FAIL | ${fail} |

Source: \`i18n-deep-forensic-rendered-results.jsonl\`
`;

fs.writeFileSync(path.join(repoRoot, '.build/I18N_RUNTIME_SURFACE_REPORT.md'), md);
console.log(`Runtime report: ${pass}/${rows.length} PASS`);

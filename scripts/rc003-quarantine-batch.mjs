#!/usr/bin/env node
/**
 * RC-003: Controlled settlement quarantine via audited admin API.
 * Usage:
 *   ADMIN_JWT=... node scripts/rc003-quarantine-batch.mjs --limit 10 --reason "RC-003 batch N"
 *   --dry-run counts eligible only
 */
import 'dotenv/config';

const base = (process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1:4000/api/v1/admin').replace(/\/$/, '');
const token = (process.env.ADMIN_JWT ?? process.env.ADMIN_ACCESS_TOKEN ?? '').trim();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const reasonArg = args.find((a) => a.startsWith('--reason='));
const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '10', 10) : 10;
const reason = reasonArg ? reasonArg.slice('--reason='.length) : 'RC-003 controlled quarantine batch';

async function main() {
  if (!token) {
    console.error('ADMIN_JWT required');
    process.exit(1);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const eligRes = await fetch(`${base}/settlement/quarantine/eligible`, { headers });
  const eligJson = await eligRes.json();
  console.log('eligible:', JSON.stringify(eligJson, null, 2));
  if (dryRun) return;
  const res = await fetch(`${base}/settlement/quarantine`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      confirm: true,
      limit,
      classification: 'synthetic_load_test',
      reason,
    }),
  });
  const json = await res.json();
  console.log('quarantine:', JSON.stringify(json, null, 2));
  if (!res.ok || !json.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

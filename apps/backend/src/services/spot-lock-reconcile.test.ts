/**
 * RC-005: spot-lock-reconcile must delegate to lockTradingBalance (ledger paired).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'spot-lock-reconcile.service.js'), 'utf8');

assert.match(src, /import.*lockTradingBalance/);
assert.doesNotMatch(src, /UPDATE user_balances[\s\S]*locked_balance = locked_balance \+/);
assert.match(src, /lockTradingBalance\(/);
assert.match(src, /spot_lock_reconcile/);

console.log('spot-lock-reconcile.test: ok');

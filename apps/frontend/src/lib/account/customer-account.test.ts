/**
 * One exchange account: profile, security, and identity are not venue-specific routes.
 * Run: npx tsx src/lib/account/customer-account.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUSTOMER_ACCOUNT_MENU, CUSTOMER_ACCOUNT_ROUTES, isVenueTradingRoute } from './customer-account.js';

for (const item of CUSTOMER_ACCOUNT_MENU) {
  assert.equal(isVenueTradingRoute(item.href), false, item.key);
  assert.equal(item.href.startsWith('/forex'), false);
}

assert.equal(CUSTOMER_ACCOUNT_ROUTES.profile, '/dashboard/account');
assert.equal(CUSTOMER_ACCOUNT_ROUTES.security, '/dashboard/security');
assert.equal(CUSTOMER_ACCOUNT_ROUTES.identity, '/dashboard/identity');
assert.equal(CUSTOMER_ACCOUNT_ROUTES.forexTrading, '/forex');
assert.notEqual(CUSTOMER_ACCOUNT_ROUTES.profile, CUSTOMER_ACCOUNT_ROUTES.forexTrading);

const enForex = readFileSync(new URL('../../../messages/en/forex.json', import.meta.url), 'utf8');
assert.equal(enForex.includes('Use your main platform password to sign in'), false);
assert.equal(enForex.includes('A password is not a sign-in method'), true);

const enAccount = readFileSync(new URL('../../../messages/en/account.json', import.meta.url), 'utf8');
assert.equal(enAccount.includes('Forex equity is not included'), true);

const enWallet = readFileSync(new URL('../../../messages/en/wallet.json', import.meta.url), 'utf8');
assert.equal(enWallet.includes('Forex equity is not included'), true);

console.log('customer-account.test.ts: PASS');
process.exit(0);

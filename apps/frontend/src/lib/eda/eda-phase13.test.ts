/**
 * Phase 13 helpers — money states and post-login redirect.
 * Run: npx tsx apps/frontend/src/lib/eda/eda-phase13.test.ts
 */
import { moneyFromBackend, moneyLabel } from './money-state';
import { resolvePostLoginRedirect } from '../oauth';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testMoneyStates(): void {
  assert(moneyFromBackend({ loading: true, failed: false, value: 0 }).kind === 'loading', 'loading wins over zero');
  assert(moneyLabel(moneyFromBackend({ loading: true, failed: false, value: 0 })) === 'Loading', 'loading label');
  assert(moneyFromBackend({ loading: false, failed: true, value: 0 }).kind === 'unavailable', 'failure is not zero');
  const zero = moneyFromBackend({ loading: false, failed: false, value: '0' });
  assert(zero.kind === 'value' && zero.formatted === '0.00', 'actual zero');
  assert(moneyLabel(zero) === '$0.00', 'zero formatted');
}

function testRedirect(): void {
  assert(resolvePostLoginRedirect('/forex/trade') === '/forex/trade', 'forex intent');
  assert(resolvePostLoginRedirect('/trade/spot') === '/trade/spot', 'crypto intent');
  assert(resolvePostLoginRedirect('/') === '/', 'root allowed');
  assert(resolvePostLoginRedirect(null, undefined) === '/', 'default customer home');
  assert(resolvePostLoginRedirect('https://evil.example') === '/', 'reject absolute');
}

testMoneyStates();
testRedirect();
console.log('eda-phase13.test.ts ok');

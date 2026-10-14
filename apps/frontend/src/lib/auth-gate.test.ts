import test from 'node:test';
import assert from 'node:assert/strict';
import { authGateRedirect } from './auth-gate';

test('a stale-looking session does not hide login or signup', () => {
  assert.equal(authGateRedirect('/login', true), null);
  assert.equal(authGateRedirect('/signup', true), null);
  assert.equal(authGateRedirect('/forgot-password', true), null);
  assert.equal(authGateRedirect('/login', false), null);
});

test('a protected page without a session still goes to login', () => {
  assert.equal(authGateRedirect('/dashboard', false), 'login');
  assert.equal(authGateRedirect('/dashboard/security', false), 'login');
  assert.equal(authGateRedirect('/wallet', false), 'login');
  assert.equal(authGateRedirect('/orders/open', false), 'login');
  assert.equal(authGateRedirect('/p2p/offers', false), 'login');
});

test('a protected page with a session is left to the client check', () => {
  assert.equal(authGateRedirect('/dashboard', true), null);
  assert.equal(authGateRedirect('/forex/trade', false), null);
});

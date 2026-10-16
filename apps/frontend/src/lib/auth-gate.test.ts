import test from 'node:test';
import assert from 'node:assert/strict';
import { authGateRedirect } from './auth-gate';
import { loginPathWithRedirect } from './authSession';

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

test('login returns to the current page and never leaves the site', () => {
  assert.equal(loginPathWithRedirect('/forex/trade'), '/login?redirect=%2Fforex%2Ftrade');
  assert.equal(
    loginPathWithRedirect('/forex/account/funds', '?tab=history'),
    '/login?redirect=%2Fforex%2Faccount%2Ffunds%3Ftab%3Dhistory',
  );
  assert.equal(loginPathWithRedirect('/dashboard/security', 'section=sessions'), '/login?redirect=%2Fdashboard%2Fsecurity%3Fsection%3Dsessions');
  assert.equal(loginPathWithRedirect(''), '/login');
  assert.equal(loginPathWithRedirect('//evil.example'), '/login');
  assert.equal(loginPathWithRedirect('/\\evil'), '/login');
  assert.equal(loginPathWithRedirect('https://evil.example'), '/login');
  assert.equal(loginPathWithRedirect('/login'), '/login');
  assert.equal(loginPathWithRedirect('/signup'), '/login');
  assert.equal(loginPathWithRedirect('/register'), '/login');
});

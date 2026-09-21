import assert from 'node:assert/strict';
import { resolveLocaleCookieSecure } from './locale-cookie-options';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    console.error(`fail ${name}`, e);
    process.exitCode = 1;
  }
}

const prevEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in prevEnv)) delete process.env[key];
  }
  Object.assign(process.env, prevEnv);
}

test('x-forwarded-proto http disables secure on production NODE_ENV', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.AUTH_COOKIE_SECURE;
  assert.equal(resolveLocaleCookieSecure('http'), false);
  restoreEnv();
});

test('x-forwarded-proto https enables secure', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.AUTH_COOKIE_SECURE;
  assert.equal(resolveLocaleCookieSecure('https'), true);
  restoreEnv();
});

test('AUTH_COOKIE_SECURE=false overrides production default', () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_COOKIE_SECURE = 'false';
  assert.equal(resolveLocaleCookieSecure(null), false);
  restoreEnv();
});

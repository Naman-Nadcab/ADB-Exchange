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

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('x-forwarded-proto http disables secure on production NODE_ENV', () => {
  setEnv('NODE_ENV', 'production');
  setEnv('AUTH_COOKIE_SECURE', undefined);
  assert.equal(resolveLocaleCookieSecure('http'), false);
  restoreEnv();
});

test('x-forwarded-proto https enables secure', () => {
  setEnv('NODE_ENV', 'production');
  setEnv('AUTH_COOKIE_SECURE', undefined);
  assert.equal(resolveLocaleCookieSecure('https'), true);
  restoreEnv();
});

test('AUTH_COOKIE_SECURE=false overrides production default', () => {
  setEnv('NODE_ENV', 'production');
  setEnv('AUTH_COOKIE_SECURE', 'false');
  assert.equal(resolveLocaleCookieSecure(null), false);
  restoreEnv();
});

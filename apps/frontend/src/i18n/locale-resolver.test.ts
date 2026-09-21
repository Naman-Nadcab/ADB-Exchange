import assert from 'node:assert/strict';
import {
  parseAcceptLanguage,
  regionCodeToSuggestedLocale,
  resolveInitialLocale,
  resolveLocale,
  resolveLocaleWithSource,
} from './locale-resolver';
import { coerceToAppLocale } from './config';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    console.error(`fail ${name}`, e);
    process.exitCode = 1;
  }
}

test('English resolves as default', () => {
  assert.equal(resolveLocale({}), 'en');
});

test('zh-CN resolves from locale cookie', () => {
  assert.equal(resolveLocale({ localeCookie: 'zh-CN' }), 'zh-CN');
});

test('manual selection wins over account preference', () => {
  assert.equal(
    resolveLocale({
      preferenceCookie: 'en',
      explicitSelection: true,
      localeCookie: 'zh-CN',
    }),
    'zh-CN'
  );
});

test('account preference wins over browser when not explicit', () => {
  assert.equal(
    resolveLocale({
      preferenceCookie: 'id-ID',
      acceptLanguage: 'en-US,en;q=0.9',
    }),
    'id-ID'
  );
});

test('explicit user selection wins over region', () => {
  assert.equal(
    resolveLocale({
      explicitSelection: true,
      localeCookie: 'en',
      regionCode: 'CN',
    }),
    'en'
  );
});

test('resolveLocaleWithSource marks manual explicit', () => {
  const r = resolveLocaleWithSource({
    explicitSelection: true,
    localeCookie: 'id-ID',
    preferenceCookie: 'en',
  });
  assert.equal(r.effectiveLocale, 'id-ID');
  assert.equal(r.localeSource, 'manual');
  assert.equal(r.isExplicit, true);
});

test('unknown locale falls back safely', () => {
  assert.equal(resolveLocale({ localeCookie: 'xx-YY' }), 'en');
});

test('browser language fallback works', () => {
  assert.equal(parseAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh-CN');
  assert.equal(resolveInitialLocale({ acceptLanguage: 'id-ID,en;q=0.5' }), 'id-ID');
});

test('de-DE browser falls back to English', () => {
  assert.equal(parseAcceptLanguage('de-DE,de;q=0.9'), null);
});

test('normalization en-US to en', () => {
  assert.equal(coerceToAppLocale('en-US'), 'en');
});

test('normalization id to id-ID', () => {
  assert.equal(coerceToAppLocale('id'), 'id-ID');
});

test('geolocation does not override explicit selection', () => {
  assert.equal(
    resolveLocale({
      explicitSelection: true,
      localeCookie: 'en',
      regionCode: 'ID',
      acceptLanguage: 'id-ID',
    }),
    'en'
  );
});

async function runExtended() {
  const { formatPrice, formatPercentage, formatTimestamp, presentationNumericValue } = await import('../lib/format/presentation');
  assert.equal(presentationNumericValue('1234.56'), 1234.56);
  assert.equal(formatPrice(null), '—');
  for (const loc of ['en', 'zh-CN', 'id-ID'] as const) {
    assert.equal(formatPrice(1000.5, { locale: loc }).includes('1'), true);
  }
  assert.ok(formatPercentage(12.5, { locale: 'en' }).length > 0);
  assert.ok(formatTimestamp('2020-01-15T12:00:00Z', { locale: 'id-ID' }).length > 0);
  console.log('ok formatter display-only checks');

  const { resolveErrorMessageKey } = await import('./errors/error-catalog');
  assert.equal(resolveErrorMessageKey('FOREX_ORDER_MARGIN_INSUFFICIENT'), 'forex.marginInsufficient');
  assert.equal(resolveErrorMessageKey('INVALID_OTP'), 'auth.codes.INVALID_OTP');
  assert.equal(resolveErrorMessageKey('NOT_A_REAL_CODE'), 'generic.unknown');
  console.log('ok error catalog fallback');
}

runExtended().then(() => {
  if (process.exitCode) process.exit(process.exitCode);
});

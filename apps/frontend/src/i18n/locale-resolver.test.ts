import assert from 'node:assert/strict';
import {
  parseAcceptLanguage,
  regionCodeToSuggestedLocale,
  resolveInitialLocale,
  resolveLocale,
} from './locale-resolver';

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

test('id-ID resolves from locale cookie', () => {
  assert.equal(resolveLocale({ localeCookie: 'id-ID' }), 'id-ID');
});

test('unknown locale falls back safely', () => {
  assert.equal(resolveLocale({ localeCookie: 'xx-YY' }), 'en');
});

test('saved preference wins over browser', () => {
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

test('saved preference wins over explicit cookie when both set', () => {
  assert.equal(
    resolveLocale({
      preferenceCookie: 'zh-CN',
      explicitSelection: true,
      localeCookie: 'en',
    }),
    'zh-CN'
  );
});

test('region suggests zh-CN for CN', () => {
  assert.equal(regionCodeToSuggestedLocale('CN'), 'zh-CN');
});

test('region suggests id-ID for ID', () => {
  assert.equal(regionCodeToSuggestedLocale('ID'), 'id-ID');
});

test('geolocation suggestion does not override explicit selection', () => {
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

test('browser language fallback works', () => {
  assert.equal(parseAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh-CN');
  assert.equal(resolveInitialLocale({ acceptLanguage: 'id-ID,en;q=0.5' }), 'id-ID');
});

test('English is final fallback', () => {
  assert.equal(resolveInitialLocale({ regionCode: 'US', acceptLanguage: 'fr-FR' }), 'en');
});

test('financial formatting numeric value unchanged (presentation isolation)', async () => {
  const { presentationNumericValue, formatPrice } = await import('../lib/format/presentation');
  assert.equal(presentationNumericValue('1234.56'), 1234.56);
  assert.equal(formatPrice(1000.5, { locale: 'en' }).includes('1'), true);
  assert.equal(formatPrice(1000.5, { locale: 'zh-CN' }).includes('1'), true);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

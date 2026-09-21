import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { errorCodeToMessageKey } from './errors/error-catalog';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (e) {
    console.error(`fail ${name}`, e);
    process.exitCode = 1;
  }
}

const messagesRoot = path.join(__dirname, '../../messages');
const locales = ['en', 'zh-CN', 'id-ID'] as const;

const CRITICAL_CRYPTO_KEYS = [
  'orderbook.recentTrades',
  'orderbook.domHint',
  'marketData.tooltipPair',
  'bottomPanel.columns.market',
  'terminal.feedUnavailable',
  'terminal.mobileTabs.chart',
  'chart.phase.live',
  'bottomToasts.orderCancelled',
];

function getNested(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

test('crypto spot critical keys exist in en, zh-CN, id-ID', () => {
  for (const locale of locales) {
    const file = path.join(messagesRoot, locale, 'crypto.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const key of CRITICAL_CRYPTO_KEYS) {
      const val = getNested(json, key);
      assert.ok(typeof val === 'string' && val.trim().length > 0, `${locale} crypto.json missing ${key}`);
      if (locale === 'zh-CN') {
        const enVal = getNested(
          JSON.parse(fs.readFileSync(path.join(messagesRoot, 'en', 'crypto.json'), 'utf8')) as Record<string, unknown>,
          key
        );
        assert.notEqual(val, enVal, `zh-CN ${key} should not copy English verbatim`);
      }
    }
  }
});

test('trading API codes resolve to errors.trading.codes keys', () => {
  assert.equal(errorCodeToMessageKey('INVALID_ORDER'), 'trading.codes.INVALID_ORDER');
  assert.equal(errorCodeToMessageKey('NETWORK_ERROR'), 'trading.codes.NETWORK_ERROR');
  for (const locale of locales) {
    const errors = JSON.parse(fs.readFileSync(path.join(messagesRoot, locale, 'errors.json'), 'utf8')) as {
      trading?: { codes?: Record<string, string> };
    };
    assert.ok(errors.trading?.codes?.INVALID_ORDER, `${locale} errors.trading.codes.INVALID_ORDER`);
  }
});

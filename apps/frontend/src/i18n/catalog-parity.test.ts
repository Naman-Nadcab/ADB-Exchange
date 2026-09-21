import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_LOCALES, MESSAGE_NAMESPACES } from './config';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

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

test('all locale namespaces exist', () => {
  for (const locale of APP_LOCALES) {
    for (const ns of MESSAGE_NAMESPACES) {
      const file = path.join(messagesRoot, locale, `${ns}.json`);
      assert.ok(fs.existsSync(file), `missing ${locale}/${ns}.json`);
      JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
});

test('en key structure is subset of zh-CN and id-ID for non-empty namespaces', () => {
  for (const ns of MESSAGE_NAMESPACES) {
    const enPath = path.join(messagesRoot, 'en', `${ns}.json`);
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8')) as Record<string, unknown>;
    const enKeys = collectKeys(en);
    if (enKeys.length === 0) continue;

    for (const locale of ['zh-CN', 'id-ID'] as const) {
      const loc = JSON.parse(fs.readFileSync(path.join(messagesRoot, locale, `${ns}.json`), 'utf8')) as Record<
        string,
        unknown
      >;
      const locKeys = new Set(collectKeys(loc));
      for (const key of enKeys) {
        assert.ok(locKeys.has(key), `${locale}/${ns}.json missing key ${key}`);
      }
    }
  }
});

if (process.exitCode) process.exit(process.exitCode);

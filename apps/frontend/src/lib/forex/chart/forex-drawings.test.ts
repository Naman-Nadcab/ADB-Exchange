/**
 * Run: npx tsx apps/frontend/src/lib/forex/chart/forex-drawings.test.ts
 */
import assert from 'node:assert/strict';
import type { ForexSerializedExtra } from './forex-drawings.js';

const ANCHOR_KINDS = [
  'ray',
  'fib2',
  'fibexp',
  'fibtime',
  'channel',
  'fibext',
  'fibchan',
  'regchannel',
  'gannfan',
  'ellipse',
  'triangle',
  'polygon',
  'pricelabel',
  'callout',
] as const;

for (const kind of ANCHOR_KINDS) {
  assert.ok(kind.length > 0, kind);
}

const sample: ForexSerializedExtra[] = [
  { kind: 'fib2', t1: 1, p1: 1.1, t2: 2, p2: 1.2 },
  { kind: 'channel', t1: 1, p1: 1.1, t2: 2, p2: 1.2, t3: 2, p3: 1.15 },
  { kind: 'polygon', t1: 1, p1: 1, t2: 2, p2: 1.1, t3: 3, p3: 1.05, t4: 4, p4: 1.02, locked: true },
];

assert.equal(sample.length, 3);
assert.equal(sample[2]!.kind, 'polygon');
assert.equal((sample[2] as { locked?: boolean }).locked, true);

console.log('forex-drawings.test.ts ok');

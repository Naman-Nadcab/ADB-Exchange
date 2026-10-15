/**
 * Run: npx tsx apps/frontend/src/lib/forex/chart/live-bar.test.ts
 */
import { foldExecutableQuote, mergeLiveBar } from './live-bar';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const history = [
  { timestamp: '2026-10-04T12:00:00.000Z', open: '1.10000', high: '1.10100', low: '1.09900', close: '1.10050' },
];

const first = foldExecutableQuote({
  history,
  previous: null,
  bid: 1.101,
  ask: 1.1012,
  timeframe: '15m',
  nowSec: Math.floor(Date.parse('2026-10-04T12:16:00.000Z') / 1000),
});
assert(first, 'first bar');
assert(first.open === 1.1005, `open seeds from previous close, got ${first.open}`);
assert(first.close === 1.1011, `close is mid, got ${first.close}`);
assert(first.high >= 1.1012 && first.low <= 1.101, 'high/low include bid and ask');

const second = foldExecutableQuote({
  history,
  previous: first,
  bid: 1.102,
  ask: 1.1024,
  timeframe: '15m',
  nowSec: Math.floor(Date.parse('2026-10-04T12:20:00.000Z') / 1000),
});
assert(second, 'second bar');
assert(second.time === first.time, 'same bucket');
assert(second.open === first.open, 'open is stable');
assert(second.high >= 1.1024, 'high expands');
assert(second.close === 1.1022, 'close follows the new mid');

const nextBucket = foldExecutableQuote({
  history,
  previous: second,
  bid: 1.103,
  ask: 1.1032,
  timeframe: '15m',
  nowSec: Math.floor(Date.parse('2026-10-04T12:30:00.000Z') / 1000),
});
assert(nextBucket && nextBucket.time !== second.time, 'new bucket');
assert(nextBucket.open === second.close, 'new bucket opens at the previous close');

const merged = mergeLiveBar(history, second, 5);
assert(merged.length === 2, 'history bar kept and live bar appended');
assert(merged[1]!.close === '1.10220', `formatted close ${merged[1]!.close}`);

const divergent = foldExecutableQuote({
  history: [{ timestamp: '2026-10-14T12:30:00.000Z', open: '1.11732', high: '1.11732', low: '1.11371', close: '1.11383' }],
  previous: null,
  bid: 1.12221,
  ask: 1.12227,
  timeframe: '15m',
  nowSec: Math.floor(Date.parse('2026-10-15T09:15:00.000Z') / 1000),
});
assert(divergent, 'divergent forming bar');
const divergentMid = (1.12221 + 1.12227) / 2;
assert(divergent.open === divergentMid, `forming open follows the quote, got ${divergent.open}`);
assert(divergent.low === Math.min(divergentMid, 1.12221), 'forming low does not inherit the old selloff');
assert(merged[0]!.low === '1.09900', 'settled history is left alone');

const stretched = foldExecutableQuote({
  history,
  previous: { time: divergent.time, open: 1.11383, high: 1.12227, low: 1.11383, close: 1.122 },
  bid: 1.12221,
  ask: 1.12227,
  timeframe: '15m',
  nowSec: Math.floor(Date.parse('2026-10-15T09:16:00.000Z') / 1000),
});
assert(stretched && stretched.open === divergentMid, 'an already stretched forming bar snaps back to the quote');
assert(stretched.low > 1.12, 'the stretched wick is not kept');

console.log('live-bar.test.ts ok');

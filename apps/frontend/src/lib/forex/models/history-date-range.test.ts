/**
 * Local calendar bounds for history lists.
 * Run: npx tsx apps/frontend/src/lib/forex/models/history-date-range.test.ts
 */
import {
  boundsAreOpen,
  boundsForRange,
  periodBounds,
  rangeFromDates,
  timestampInBounds,
} from './history-analytics';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const now = new Date(2026, 9, 15, 15, 30, 0);

const today = periodBounds('today', now);
assert(today.from === new Date(2026, 9, 15, 0, 0, 0, 0).getTime(), 'today starts at local midnight');
assert(today.to === new Date(2026, 9, 15, 23, 59, 59, 999).getTime(), 'today ends at local end of day');

const custom = periodBounds('custom', now, { from: '2026-10-01', to: '2026-10-02' });
assert(custom.from === new Date(2026, 9, 1, 0, 0, 0, 0).getTime(), 'custom from is the local start of that day');
assert(custom.to === new Date(2026, 9, 2, 23, 59, 59, 999).getTime(), 'custom to includes the whole local day');

const swapped = periodBounds('custom', now, { from: '2026-10-05', to: '2026-10-01' });
assert(swapped.from === new Date(2026, 9, 1, 0, 0, 0, 0).getTime(), 'a reversed custom range still starts on the earlier day');
assert(swapped.to === new Date(2026, 9, 5, 23, 59, 59, 999).getTime(), 'a reversed custom range ends on the later day');

const openEnded = periodBounds('custom', now, { from: '2026-10-10', to: '' });
assert(openEnded.from === new Date(2026, 9, 10, 0, 0, 0, 0).getTime(), 'a from date with no to stays open');
assert(openEnded.to === Number.MAX_SAFE_INTEGER, 'missing to does not cut the range at now');

const all = boundsForRange({ period: 'all', from: '', to: '' }, now);
assert(boundsAreOpen(all), 'all history is unrestricted');
assert(timestampInBounds('not-a-date', all), 'an open range keeps rows that have no parseable time');
assert(!timestampInBounds('2026-09-01T00:00:00.000Z', custom), 'a day before the custom range is excluded');
assert(timestampInBounds('2026-10-02T18:00:00', custom) || timestampInBounds(new Date(2026, 9, 2, 18, 0, 0).toISOString(), custom), 'the custom end day is included');

const cleared = rangeFromDates('', '');
assert(cleared.period === 'all' && cleared.from === '' && cleared.to === '', 'clearing both dates returns every row');

console.log('history-date-range.test.ts ok');

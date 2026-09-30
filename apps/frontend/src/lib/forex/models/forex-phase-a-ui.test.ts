/**
 * Phase A frontend contract: stop_limit + Time in Force ticket rules, and the
 * honest Change % reference.
 *
 * Run: npx tsx src/lib/forex/models/forex-phase-a-ui.test.ts
 */
import {
  computeChangePct,
  describeForexChange,
  formatChangePct,
  quoteMid,
  type ForexChangeReference,
} from './change-pct';
import {
  availableOrderTypes,
  availableTimeInForce,
  coerceTimeInForce,
  FOREX_ORDER_TYPE_LABEL,
  isPendingOrderType,
  isTimeInForceAllowed,
  requiresLimitPrice,
  requiresTriggerPrice,
  timeInForceBlockedReason,
  unavailableTicketFeatures,
} from './order-type-tif';
import { isPreviewParamComplete, previewRequestKey } from './preview';
import type { ForexQuoteDto, ForexTimeInForce, ForexTradingConfig } from './types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function config(over: Partial<ForexTradingConfig> = {}): ForexTradingConfig {
  return {
    source: 'SIMULATED',
    executionMode: 'MOCK',
    orderTypes: ['market', 'limit', 'stop', 'stop_limit'],
    timeInForce: ['GTC', 'IOC', 'FOK', 'DAY'],
    sessions: {} as ForexTradingConfig['sessions'],
    fees: {},
    swaps: {},
    leverage: {},
    holiday: { coverage: 'UNCONFIGURED', required: false, holidaySafe: true, dstApplied: false },
    ...over,
  };
}

function quote(over: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  return {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    instrumentId: 'i',
    bid: '1.16620',
    ask: '1.16640',
    mid: '1.16630',
    spread: '0.00020',
    spreadPips: '2.0',
    spreadTicks: '20',
    providerId: 'p',
    providerCode: 'MOCK-A',
    providerTimestamp: '2026-09-04T00:00:00.000Z',
    receivedTimestamp: '2026-09-04T00:00:00.000Z',
    sequence: '1',
    edaReceiveSequence: '1',
    quality: 'OK',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
    ...over,
  };
}

// --- order type surface ---
{
  assert(FOREX_ORDER_TYPE_LABEL.stop_limit === 'Stop Limit', 'stop_limit needs a label');
  assert(isPendingOrderType('stop_limit'), 'stop_limit rests on the book');
  assert(isPendingOrderType('market') === false, 'market is not pending');
  assert(requiresTriggerPrice('stop_limit') && requiresLimitPrice('stop_limit'), 'stop_limit needs both prices');
  assert(requiresLimitPrice('limit') === false, 'a plain limit has no second price');
  assert(requiresTriggerPrice('market') === false, 'market needs no trigger');

  const advertised = availableOrderTypes(config());
  assert(advertised.includes('stop_limit'), 'advertised stop_limit must be offered');
  // A pre-Phase-A backend advertises fewer types; the UI must not add one.
  assert(
    availableOrderTypes(config({ orderTypes: ['market', 'limit'] })).includes('stop_limit') === false,
    'never offer an unadvertised type'
  );
  assert(availableOrderTypes(null).join(',') === 'market,limit,stop', 'safe default without config');
  console.log('  PASS  order type surface follows the backend advertisement');
}

// --- TIF legality mirrors validate.ts ---
{
  const all: ForexTimeInForce[] = ['GTC', 'IOC', 'FOK', 'DAY'];
  for (const tif of all) assert(isTimeInForceAllowed('market', tif) === (tif !== 'DAY'), `market/${tif}`);
  for (const type of ['limit', 'stop', 'stop_limit'] as const) {
    assert(isTimeInForceAllowed(type, 'GTC'), `${type}/GTC must be allowed`);
    assert(isTimeInForceAllowed(type, 'DAY'), `${type}/DAY must be allowed`);
    assert(isTimeInForceAllowed(type, 'IOC') === false, `${type}/IOC must be blocked`);
    assert(isTimeInForceAllowed(type, 'FOK') === false, `${type}/FOK must be blocked`);
  }
  assert(timeInForceBlockedReason('market', 'GTC') === null, 'legal combos carry no reason');
  assert((timeInForceBlockedReason('limit', 'IOC') ?? '').includes('IOC'), 'blocked IOC needs helper text');
  assert((timeInForceBlockedReason('market', 'DAY') ?? '').includes('pending'), 'blocked DAY needs helper text');

  assert(availableTimeInForce(config()).join(',') === 'GTC,IOC,FOK,DAY', 'advertised TIF order is canonical');
  assert(availableTimeInForce(null).join(',') === 'GTC', 'silent backend means GTC only');
  assert(availableTimeInForce(config({ timeInForce: ['DAY'] })).join(',') === 'DAY', 'respect a narrow advertisement');
  assert(
    availableTimeInForce(config({ timeInForce: ['NONSENSE' as ForexTimeInForce] })).join(',') === 'GTC',
    'unknown TIF values are ignored'
  );

  // Switching type must never leave an illegal TIF selected.
  const opts = availableTimeInForce(config());
  assert(coerceTimeInForce('limit', 'IOC', opts) === 'GTC', 'IOC on a limit falls back to GTC');
  assert(coerceTimeInForce('market', 'DAY', opts) === 'GTC', 'DAY on a market falls back to GTC');
  assert(coerceTimeInForce('stop_limit', 'DAY', opts) === 'DAY', 'legal selection is preserved');
  assert(coerceTimeInForce('market', 'IOC', ['GTC']) === 'GTC', 'never select an unadvertised TIF');
  console.log('  PASS  TIF legality + coercion mirror the backend');
}

// --- unavailable banner only reports genuinely missing capability ---
{
  assert(unavailableTicketFeatures(config()).length === 0, 'nothing is unavailable on a Phase A backend');
  const legacy = unavailableTicketFeatures(config({ orderTypes: ['market', 'limit', 'stop'], timeInForce: [] }));
  assert(legacy.includes('Stop Limit unavailable'), 'legacy backend still reports stop limit');
  assert(legacy.includes('Time in Force unavailable'), 'legacy backend still reports TIF');
  console.log('  PASS  unavailability banner is capability-driven');
}

// --- preview carries the new fields ---
{
  const base = { symbol: 'EURUSD', side: 'buy' as const, volume: '0.10' };
  assert(isPreviewParamComplete({ ...base, orderType: 'market' }), 'market preview needs no price');
  assert(
    isPreviewParamComplete({ ...base, orderType: 'stop_limit', requestedPrice: '1.17' }) === false,
    'stop_limit preview needs a limit price'
  );
  assert(
    isPreviewParamComplete({ ...base, orderType: 'stop_limit', requestedPrice: '1.17', limitPrice: '1.169' }),
    'stop_limit preview is complete with both prices'
  );
  const a = previewRequestKey({ ...base, orderType: 'stop_limit', requestedPrice: '1.17', limitPrice: '1.169' });
  const b = previewRequestKey({ ...base, orderType: 'stop_limit', requestedPrice: '1.17', limitPrice: '1.168' });
  assert(a !== b, 'limit price must take part in the preview cache key');
  const c = previewRequestKey({ ...base, orderType: 'market', timeInForce: 'IOC' });
  const d = previewRequestKey({ ...base, orderType: 'market', timeInForce: 'FOK' });
  assert(c !== d, 'TIF must take part in the preview cache key');
  console.log('  PASS  preview key + completeness cover limitPrice and TIF');
}

// --- Change %: math ---
{
  const near = (actual: number | null, expected: number) =>
    actual != null && Math.abs(actual - expected) < 1e-9;
  assert(near(computeChangePct('1.10000', '1.00000'), 10), '10% up');
  assert(near(computeChangePct('0.90000', '1.00000'), -10), '10% down');
  assert(computeChangePct('1.00000', '1.00000') === 0, 'flat');
  assert(computeChangePct('1.10000', '0') === null, 'zero reference is not a reference');
  assert(computeChangePct('1.10000', undefined) === null, 'missing reference');
  assert(computeChangePct(undefined, '1.00000') === null, 'missing mid');
  assert(computeChangePct('abc', '1.00000') === null, 'non-numeric mid');
  assert(formatChangePct(1.234) === '+1.23%', 'positive is signed');
  assert(formatChangePct(-1.235) === '-1.24%', 'negative keeps its sign');
  console.log('  PASS  Change % math');
}

// --- Change %: mid resolution ---
{
  assert(quoteMid(quote()) === '1.16630', 'published mid wins');
  assert(quoteMid(quote({ mid: '' })) === '1.166300', 'bid/ask midpoint is the fallback');
  assert(quoteMid(quote({ mid: '', bid: '1.16620', ask: '1.16631' })) === '1.166255', 'half-tick midpoint is exact');
  assert(quoteMid(quote({ mid: '', bid: '', ask: '' })) === undefined, 'no usable prices means no mid');
  assert(quoteMid(undefined) === undefined, 'no quote means no mid');
  console.log('  PASS  mid resolution');
}

// --- Change %: honest n/a when there is no reference ---
{
  const ref: ForexChangeReference = {
    symbol: 'EURUSD',
    open: '1.16000',
    timestamp: '2026-09-04T00:00:00.000Z',
    timeframe: '1D',
    source: 'EXTERNAL',
  };
  const ready = describeForexChange({ quote: quote(), reference: ref });
  assert(ready.status === 'READY', 'a usable reference produces a value');
  assert(ready.text === '+0.54%', `unexpected change text ${ready.text}`);
  assert(ready.direction === 'up', 'direction follows the sign');
  assert(ready.title.includes('session open 1.16000'), 'title must name the reference');
  assert(ready.title.includes('1D'), 'title must name the timeframe');
  assert(ready.title.includes('SIMULATED'), 'title must disclose the simulated mid');

  const noRef = describeForexChange({ quote: quote(), reference: null, referenceStatus: 'unavailable' });
  assert(noRef.status === 'NO_REFERENCE' && noRef.text === 'n/a', 'no reference means n/a, never 0%');
  assert(noRef.title.includes('no reference'), 'n/a must explain itself');

  const loading = describeForexChange({ quote: quote(), reference: null, referenceStatus: 'loading' });
  assert(loading.text === 'n/a' && loading.title.includes('Loading'), 'loading is still n/a');

  const noQuote = describeForexChange({ quote: undefined, reference: ref });
  assert(noQuote.status === 'NO_REFERENCE' && noQuote.text === 'n/a', 'no mid means n/a');
  console.log('  PASS  Change % stays n/a instead of inventing a baseline');
}

console.log('\nforex-phase-a-ui.test: ok');

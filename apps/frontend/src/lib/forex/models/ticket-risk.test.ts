/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/ticket-risk.test.ts
 */
import { protectionPriceFromInput, stepLotVolume } from './ticket-risk';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const bounds = { minVolume: '0.01', maxVolume: '50', volumeStep: '0.01' };

assert(stepLotVolume('0.10', 1, bounds) === '0.11', 'step up');
assert(stepLotVolume('0.10', -1, bounds) === '0.09', 'step down');
assert(stepLotVolume('0.01', -1, bounds) === '0.01', 'clamp min');
assert(stepLotVolume('50', 1, bounds) === '50.00', 'clamp max');

const pip = 0.0001;
const entry = 1.1195;
assert(
  protectionPriceFromInput({
    side: 'buy',
    kind: 'sl',
    entry,
    raw: '20',
    mode: 'pips',
    pipSize: pip,
    digits: 5,
  }) === '1.11750',
  'buy sl 20 pips below ask'
);
assert(
  protectionPriceFromInput({
    side: 'buy',
    kind: 'tp',
    entry,
    raw: '20',
    mode: 'pips',
    pipSize: pip,
    digits: 5,
  }) === '1.12150',
  'buy tp 20 pips above ask'
);
assert(
  protectionPriceFromInput({
    side: 'sell',
    kind: 'sl',
    entry: 1.11944,
    raw: '10',
    mode: 'pips',
    pipSize: pip,
    digits: 5,
  }) === '1.12044',
  'sell sl 10 pips above bid'
);
assert(
  protectionPriceFromInput({
    side: 'buy',
    kind: 'sl',
    entry,
    raw: '1.11000',
    mode: 'price',
    pipSize: pip,
    digits: 5,
  }) === '1.11000',
  'price mode stays a price'
);
assert(
  protectionPriceFromInput({
    side: 'buy',
    kind: 'sl',
    entry: null,
    raw: '20',
    mode: 'pips',
    pipSize: pip,
    digits: 5,
  }) === undefined,
  'pips without entry are not sent'
);

console.log('ticket-risk ok');

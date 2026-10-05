/**
 * Compare a broker snapshot to the forex ledger and open positions.
 * The diff is a report. It does not post cash or invent fills.
 */
import { fxDecimal } from '../decimal-fx.js';

export type ReconPosition = { symbol: string; side: string; volume: string };

export type PositionDrift = {
  symbol: string;
  side: string;
  localVolume: string;
  brokerVolume: string;
};

function vol(value: string | null | undefined): string {
  if (value == null || value === '') return '0';
  try {
    const n = fxDecimal(value);
    if (!n.isFinite()) return '0';
    return n.toFixed();
  } catch {
    return '0';
  }
}

function key(symbol: string, side: string): string {
  return `${symbol.toUpperCase()}|${side.toLowerCase()}`;
}

export function diffBrokerCashAndPositions(args: {
  ledgerBalance: string;
  brokerBalance: string | null;
  localPositions: ReconPosition[];
  brokerPositions: ReconPosition[];
}): { cashDelta: string | null; positionDrift: PositionDrift[] } {
  let cashDelta: string | null = null;
  if (args.brokerBalance != null && args.brokerBalance !== '') {
    try {
      cashDelta = fxDecimal(args.brokerBalance).minus(fxDecimal(args.ledgerBalance || '0')).toFixed();
    } catch {
      cashDelta = null;
    }
  }
  const local = new Map<string, string>();
  const broker = new Map<string, string>();
  for (const row of args.localPositions) local.set(key(row.symbol, row.side), vol(row.volume));
  for (const row of args.brokerPositions) broker.set(key(row.symbol, row.side), vol(row.volume));
  const drift: PositionDrift[] = [];
  const seen = new Set<string>([...local.keys(), ...broker.keys()]);
  for (const id of seen) {
    const localVolume = local.get(id) ?? '0';
    const brokerVolume = broker.get(id) ?? '0';
    if (fxDecimal(localVolume).eq(brokerVolume)) continue;
    const [symbol, side] = id.split('|');
    drift.push({ symbol: symbol ?? '', side: side ?? '', localVolume, brokerVolume });
  }
  drift.sort((a, b) => `${a.symbol}${a.side}`.localeCompare(`${b.symbol}${b.side}`));
  return { cashDelta, positionDrift: drift };
}

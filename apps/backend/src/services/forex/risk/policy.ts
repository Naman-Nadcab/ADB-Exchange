/**
 * Admin-ready Forex risk configuration. Env supplies defaults only.
 * Runtime policy is this layer — never hardcode limits in HTTP routes.
 *
 * Hierarchy (strictest wins): GLOBAL → INSTRUMENT → ACCOUNT → POSITION
 */
import { effectiveDefaultAccountLeverage, effectiveGlobalMaxLeverage } from '../admin/effective-config.js';
import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { effectiveLeverage } from '../margin/leverage.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';

export interface ForexLimitSlice {
  maxOrderVolume?: string;
  maxPositionVolume?: string;
  maxSymbolExposure?: string;
  maxAccountGrossExposure?: string;
  maxAccountNetExposure?: string;
  maxAggregateForexExposure?: string;
  maxLeverage?: string;
  maxMarginUtilization?: string;
  maxOpenPositions?: number;
  maxOrdersPerSymbol?: number;
  maxSpread?: string;
  tradingDisabled?: boolean;
}

export interface ForexResolvedLimits {
  maxOrderVolume: string;
  maxPositionVolume: string;
  maxSymbolExposure: string;
  maxAccountGrossExposure: string;
  maxAccountNetExposure: string;
  maxAggregateForexExposure: string;
  maxLeverage: string;
  maxMarginUtilization: string;
  maxOpenPositions: number;
  maxOrdersPerSymbol: number;
  maxSpread: string;
  tradingDisabled: boolean;
  sources: Record<string, 'GLOBAL' | 'INSTRUMENT' | 'ACCOUNT' | 'POSITION'>;
}

const globalLimits: ForexLimitSlice = {};
const instrumentLimits = new Map<string, ForexLimitSlice>();
const accountLimits = new Map<string, ForexLimitSlice>();
const positionLimits = new Map<string, ForexLimitSlice>();

export function defaultGlobalLimits(): ForexLimitSlice {
  return {
    maxOrderVolume: forexConfig.maxOrderVolume,
    maxPositionVolume: forexConfig.maxPositionVolume,
    maxSymbolExposure: forexConfig.maxSymbolExposure,
    maxAccountGrossExposure: forexConfig.maxTotalExposure,
    maxAccountNetExposure: forexConfig.maxTotalExposure,
    maxAggregateForexExposure: forexConfig.maxTotalExposure,
    maxLeverage: effectiveGlobalMaxLeverage(),
    maxMarginUtilization: forexConfig.maxMarginUtilization,
    maxOpenPositions: Number.parseInt(process.env.FOREX_MAX_OPEN_POSITIONS ?? '20', 10) || 20,
    maxOrdersPerSymbol: Number.parseInt(process.env.FOREX_MAX_ORDERS_PER_SYMBOL ?? '10', 10) || 10,
    maxSpread: process.env.FOREX_MAX_QUOTE_SPREAD?.trim() || '0.05000',
    tradingDisabled: effectiveForexRuntimeFlags().killSwitch,
  };
}

export function setForexGlobalLimits(patch: ForexLimitSlice): void {
  Object.assign(globalLimits, patch);
}

export function setForexInstrumentLimits(symbol: string, patch: ForexLimitSlice): void {
  instrumentLimits.set(symbol.toUpperCase(), { ...instrumentLimits.get(symbol.toUpperCase()), ...patch });
}

export function setForexAccountLimits(accountId: string, patch: ForexLimitSlice): void {
  accountLimits.set(accountId, { ...accountLimits.get(accountId), ...patch });
}

export function setForexPositionLimits(positionId: string, patch: ForexLimitSlice): void {
  positionLimits.set(positionId, { ...positionLimits.get(positionId), ...patch });
}

export function resetForexRiskLimitsForTests(): void {
  for (const k of Object.keys(globalLimits)) delete (globalLimits as Record<string, unknown>)[k];
  instrumentLimits.clear();
  accountLimits.clear();
  positionLimits.clear();
}

function minStr(values: Array<{ v?: string; src: ForexResolvedLimits['sources'][string] }>, key: string, sources: ForexResolvedLimits['sources']): string {
  let best: ReturnType<typeof fxDecimal> | null = null;
  let src: ForexResolvedLimits['sources'][string] = 'GLOBAL';
  for (const row of values) {
    if (row.v == null || row.v === '') continue;
    const d = fxDecimal(row.v);
    if (best == null || d.lt(best)) {
      best = d;
      src = row.src;
    }
  }
  sources[key] = src;
  return (best ?? fxDecimal(0)).toFixed();
}

function minInt(values: Array<{ v?: number; src: ForexResolvedLimits['sources'][string] }>, key: string, sources: ForexResolvedLimits['sources']): number {
  let best: number | null = null;
  let src: ForexResolvedLimits['sources'][string] = 'GLOBAL';
  for (const row of values) {
    if (row.v == null || !Number.isFinite(row.v)) continue;
    if (best == null || row.v < best) {
      best = row.v;
      src = row.src;
    }
  }
  sources[key] = src;
  return best ?? 0;
}

/**
 * Strictest applicable limit wins. A weaker lower-level value cannot loosen a tighter parent.
 */
export function resolveEffectiveLimits(args: { symbol: string; accountId: string; positionId?: string }): ForexResolvedLimits {
  const g = { ...defaultGlobalLimits(), ...globalLimits };
  const i = instrumentLimits.get(args.symbol.toUpperCase()) ?? {};
  const a = accountLimits.get(args.accountId) ?? {};
  const p = args.positionId ? positionLimits.get(args.positionId) ?? {} : {};
  const sources: ForexResolvedLimits['sources'] = {};
  const instrument = getForexInstrumentBySymbol(args.symbol);
  const maxLeverage = effectiveLeverage({
    globalMax: g.maxLeverage ?? effectiveGlobalMaxLeverage(),
    accountMax: a.maxLeverage ?? effectiveDefaultAccountLeverage(),
    instrumentMax: i.maxLeverage ?? instrument?.maxLeverage ?? effectiveDefaultAccountLeverage(),
  });
  sources.maxLeverage = 'GLOBAL';
  if (a.maxLeverage && fxDecimal(a.maxLeverage).lte(maxLeverage)) sources.maxLeverage = 'ACCOUNT';
  if (i.maxLeverage && fxDecimal(i.maxLeverage).lte(maxLeverage)) sources.maxLeverage = 'INSTRUMENT';
  return {
    maxOrderVolume: minStr(
      [
        { v: g.maxOrderVolume, src: 'GLOBAL' },
        { v: i.maxOrderVolume, src: 'INSTRUMENT' },
        { v: a.maxOrderVolume, src: 'ACCOUNT' },
        { v: p.maxOrderVolume, src: 'POSITION' },
      ],
      'maxOrderVolume',
      sources
    ),
    maxPositionVolume: minStr(
      [
        { v: g.maxPositionVolume, src: 'GLOBAL' },
        { v: i.maxPositionVolume, src: 'INSTRUMENT' },
        { v: a.maxPositionVolume, src: 'ACCOUNT' },
        { v: p.maxPositionVolume, src: 'POSITION' },
      ],
      'maxPositionVolume',
      sources
    ),
    maxSymbolExposure: minStr(
      [
        { v: g.maxSymbolExposure, src: 'GLOBAL' },
        { v: i.maxSymbolExposure, src: 'INSTRUMENT' },
        { v: a.maxSymbolExposure, src: 'ACCOUNT' },
      ],
      'maxSymbolExposure',
      sources
    ),
    maxAccountGrossExposure: minStr(
      [
        { v: g.maxAccountGrossExposure, src: 'GLOBAL' },
        { v: a.maxAccountGrossExposure, src: 'ACCOUNT' },
      ],
      'maxAccountGrossExposure',
      sources
    ),
    maxAccountNetExposure: minStr(
      [
        { v: g.maxAccountNetExposure, src: 'GLOBAL' },
        { v: a.maxAccountNetExposure, src: 'ACCOUNT' },
      ],
      'maxAccountNetExposure',
      sources
    ),
    maxAggregateForexExposure: minStr([{ v: g.maxAggregateForexExposure, src: 'GLOBAL' }], 'maxAggregateForexExposure', sources),
    maxLeverage,
    maxMarginUtilization: minStr(
      [
        { v: g.maxMarginUtilization, src: 'GLOBAL' },
        { v: a.maxMarginUtilization, src: 'ACCOUNT' },
      ],
      'maxMarginUtilization',
      sources
    ),
    maxOpenPositions: minInt(
      [
        { v: g.maxOpenPositions, src: 'GLOBAL' },
        { v: a.maxOpenPositions, src: 'ACCOUNT' },
      ],
      'maxOpenPositions',
      sources
    ),
    maxOrdersPerSymbol: minInt(
      [
        { v: g.maxOrdersPerSymbol, src: 'GLOBAL' },
        { v: i.maxOrdersPerSymbol, src: 'INSTRUMENT' },
        { v: a.maxOrdersPerSymbol, src: 'ACCOUNT' },
      ],
      'maxOrdersPerSymbol',
      sources
    ),
    maxSpread: minStr(
      [
        { v: g.maxSpread, src: 'GLOBAL' },
        { v: i.maxSpread, src: 'INSTRUMENT' },
      ],
      'maxSpread',
      sources
    ),
    tradingDisabled: Boolean(g.tradingDisabled || i.tradingDisabled || a.tradingDisabled || p.tradingDisabled),
    sources,
  };
}

export function snapshotForexRiskPolicy() {
  return {
    global: { ...defaultGlobalLimits(), ...globalLimits },
    instruments: Object.fromEntries(instrumentLimits),
    accounts: Object.fromEntries(accountLimits),
    source: 'SIMULATED' as const,
  };
}

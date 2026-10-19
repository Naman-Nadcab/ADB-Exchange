/**
 * LP-ready desk policy.
 * Settings are applied in memory for the running engine and stored in
 * system_settings so they survive a backend restart.
 * Book mode is stored for the gateway. Customer fills stay MOCK until a
 * live broker is actually healthy — this module does not retarget execution.
 */
import { db } from '../../../lib/database.js';
import { fxDecimal } from '../decimal-fx.js';
import {
  forexLeverageRuntimeOverrides,
  forexMarginRuntimeOverrides,
  listForexInstrumentPolicyOverrides,
  setForexInstrumentPolicyOverride,
  setForexLeverageOverride,
  setForexMarginOverride,
  type ForexInstrumentPolicyOverride,
} from './effective-config.js';
import {
  forexRuntimeBoolOverrides,
  listForexInstrumentTradingStatusOverrides,
  setForexInstrumentTradingStatus,
  setForexRuntimeBool,
  type ForexRuntimeBoolKey,
} from './runtime-controls.js';

export const FOREX_DESK_POLICY_KEY = 'forex_desk_policy_v1';

export type ForexBookMode = 'A_BOOK' | 'B_BOOK' | 'HYBRID';

export type ForexDeskOrderPolicy = {
  market: boolean;
  limit: boolean;
  stop: boolean;
  stop_limit: boolean;
  GTC: boolean;
  DAY: boolean;
  IOC: boolean;
  FOK: boolean;
  dayExpiry: boolean;
};

export type ForexInstrumentDeskExtra = {
  volumeStep?: string;
  swapLong?: string;
  swapShort?: string;
  commission?: string;
  spreadMarkupPips?: string;
  stopsLevelPips?: string;
};

const DEFAULT_ORDER_POLICY: ForexDeskOrderPolicy = {
  market: true,
  limit: true,
  stop: true,
  stop_limit: true,
  GTC: true,
  DAY: true,
  IOC: true,
  FOK: true,
  dayExpiry: true,
};

let bookMode: ForexBookMode = 'B_BOOK';
let orderPolicy: ForexDeskOrderPolicy = { ...DEFAULT_ORDER_POLICY };
const extras = new Map<string, ForexInstrumentDeskExtra>();

function normSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function signedDecimal(field: string, raw: string): string {
  const v = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new Error(`INVALID_${field}`);
  if (!fxDecimal(v).isFinite()) throw new Error(`INVALID_${field}`);
  return v;
}

function positiveOrZero(field: string, raw: string, allowZero: boolean): string {
  const v = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`INVALID_${field}`);
  const n = fxDecimal(v);
  if (!n.isFinite() || (allowZero ? n.lt(0) : n.lte(0))) throw new Error(`INVALID_${field}`);
  return v;
}

export function getForexBookMode(): ForexBookMode {
  return bookMode;
}

export function getForexDeskOrderPolicy(): ForexDeskOrderPolicy {
  return { ...orderPolicy };
}

export function isForexDayExpiryEnabled(): boolean {
  return orderPolicy.dayExpiry;
}

export function isForexOrderTypeDeskEnabled(orderType: string): boolean {
  if (orderType === 'market') return orderPolicy.market;
  if (orderType === 'limit') return orderPolicy.limit;
  if (orderType === 'stop') return orderPolicy.stop;
  if (orderType === 'stop_limit') return orderPolicy.stop_limit;
  return true;
}

export function isForexTifDeskEnabled(tif: string): boolean {
  if (tif === 'GTC') return orderPolicy.GTC;
  if (tif === 'DAY') return orderPolicy.DAY;
  if (tif === 'IOC') return orderPolicy.IOC;
  if (tif === 'FOK') return orderPolicy.FOK;
  return true;
}

export function getForexInstrumentDeskExtra(symbol: string): ForexInstrumentDeskExtra | undefined {
  const row = extras.get(normSymbol(symbol));
  return row ? { ...row } : undefined;
}

export function listForexInstrumentDeskExtras(): Array<{ symbol: string; extra: ForexInstrumentDeskExtra }> {
  return [...extras.entries()].map(([symbol, extra]) => ({ symbol, extra: { ...extra } }));
}

export function setForexBookMode(next: string): ForexBookMode {
  const mode = next.trim().toUpperCase();
  if (mode !== 'A_BOOK' && mode !== 'B_BOOK' && mode !== 'HYBRID') throw new Error('INVALID_BOOK_MODE');
  bookMode = mode;
  void persistForexDeskPolicy();
  return bookMode;
}

export function setForexDeskOrderPolicy(patch: Partial<ForexDeskOrderPolicy>): ForexDeskOrderPolicy {
  const next = { ...orderPolicy };
  for (const key of Object.keys(DEFAULT_ORDER_POLICY) as Array<keyof ForexDeskOrderPolicy>) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  }
  if (!next.market && !next.limit && !next.stop && !next.stop_limit) throw new Error('ORDER_TYPES_EMPTY');
  orderPolicy = next;
  void persistForexDeskPolicy();
  return getForexDeskOrderPolicy();
}

export function setForexInstrumentDeskExtra(symbol: string, patch: ForexInstrumentDeskExtra): ForexInstrumentDeskExtra {
  const sym = normSymbol(symbol);
  if (!sym) throw new Error('UNKNOWN_INSTRUMENT');
  const prev = extras.get(sym) ?? {};
  const next: ForexInstrumentDeskExtra = { ...prev };
  if (patch.volumeStep != null) next.volumeStep = positiveOrZero('VOLUME_STEP', patch.volumeStep, false);
  if (patch.swapLong != null) next.swapLong = signedDecimal('SWAP_LONG', patch.swapLong);
  if (patch.swapShort != null) next.swapShort = signedDecimal('SWAP_SHORT', patch.swapShort);
  if (patch.commission != null) next.commission = positiveOrZero('COMMISSION', patch.commission, true);
  if (patch.spreadMarkupPips != null) next.spreadMarkupPips = positiveOrZero('SPREAD_MARKUP', patch.spreadMarkupPips, true);
  if (patch.stopsLevelPips != null) next.stopsLevelPips = positiveOrZero('STOPS_LEVEL', patch.stopsLevelPips, true);
  extras.set(sym, next);
  void applyExtraToEngines(sym, next);
  void persistForexDeskPolicy();
  return { ...next };
}

/** Widen an existing bid/ask. A zero spread is left unchanged so a mock quote is not painted. */
export function widenQuoteForDeskMarkup(symbol: string, bidRaw: string, askRaw: string, pipSize: string): { bid: string; ask: string } {
  const bid = fxDecimal(bidRaw);
  const ask = fxDecimal(askRaw);
  const markup = extras.get(normSymbol(symbol))?.spreadMarkupPips;
  if (!markup || !ask.gt(bid)) return { bid: bid.toFixed(), ask: ask.toFixed() };
  const pips = fxDecimal(markup);
  if (!pips.gt(0)) return { bid: bid.toFixed(), ask: ask.toFixed() };
  const half = fxDecimal(pipSize).mul(pips).div(2);
  return { bid: bid.minus(half).toFixed(), ask: ask.plus(half).toFixed() };
}

async function applyExtraToEngines(symbol: string, extra: ForexInstrumentDeskExtra): Promise<void> {
  if (extra.swapLong != null || extra.swapShort != null) {
    const { setForexInstrumentSwap } = await import('../swap/policy.js');
    setForexInstrumentSwap(symbol, {
      ...(extra.swapLong != null ? { longSwap: extra.swapLong } : {}),
      ...(extra.swapShort != null ? { shortSwap: extra.swapShort } : {}),
    });
  }
  if (extra.commission != null) {
    const { setForexInstrumentCommission } = await import('../fees/policy.js');
    setForexInstrumentCommission(symbol, { rate: extra.commission, model: 'per_lot' });
  }
}

type StoredDeskPolicy = {
  bookMode?: ForexBookMode;
  orderPolicy?: Partial<ForexDeskOrderPolicy>;
  extras?: Array<{ symbol: string; extra: ForexInstrumentDeskExtra }>;
  instrumentPolicy?: Array<{ symbol: string; override: ForexInstrumentPolicyOverride }>;
  leverage?: Partial<Record<'globalMaxLeverage' | 'defaultAccountLeverage', string>>;
  margin?: Partial<Record<'marginWarningLevel' | 'marginCallLevel' | 'stopOutLevel' | 'maintenanceRatio', string>>;
  commission?: { model?: string; rate?: string; buyRate?: string; sellRate?: string; minimum?: string };
  swap?: { longSwap?: string; shortSwap?: string; model?: string; rolloverTime?: string; timezone?: string; tripleSwapDay?: number };
  runtimeBools?: Partial<Record<ForexRuntimeBoolKey, boolean>>;
  tradingStatus?: Array<{ symbol: string; tradingStatus: 'active' | 'halted' | 'closed' }>;
};

function capture(): StoredDeskPolicy {
  return {
    bookMode,
    orderPolicy,
    extras: listForexInstrumentDeskExtras(),
    instrumentPolicy: listForexInstrumentPolicyOverrides(),
    leverage: forexLeverageRuntimeOverrides(),
    margin: forexMarginRuntimeOverrides(),
    runtimeBools: forexRuntimeBoolOverrides(),
    tradingStatus: listForexInstrumentTradingStatusOverrides(),
  };
}

export async function persistForexDeskPolicy(): Promise<void> {
  try {
    const { listForexCommissionPolicies } = await import('../fees/policy.js');
    const { listForexSwapPolicies } = await import('../swap/policy.js');
    const blob: StoredDeskPolicy = {
      ...capture(),
      commission: listForexCommissionPolicies().global,
      swap: listForexSwapPolicies().global,
    };
    await db.query(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [FOREX_DESK_POLICY_KEY, JSON.stringify(blob), 'Forex desk policy persisted for LP-ready administration'],
    );
  } catch {
    /* system_settings missing or database down — memory copy still applies */
  }
}

export async function hydrateForexDeskPolicyFromDb(): Promise<boolean> {
  try {
    const res = await db.query<{ value: unknown }>(`SELECT value FROM system_settings WHERE key = $1 LIMIT 1`, [
      FOREX_DESK_POLICY_KEY,
    ]);
    const value = res.rows[0]?.value;
    if (!value || typeof value !== 'object') return false;
    const stored = value as StoredDeskPolicy;
    if (stored.bookMode === 'A_BOOK' || stored.bookMode === 'B_BOOK' || stored.bookMode === 'HYBRID') {
      bookMode = stored.bookMode;
    }
    if (stored.orderPolicy) orderPolicy = { ...DEFAULT_ORDER_POLICY, ...stored.orderPolicy };
    extras.clear();
    for (const row of stored.extras ?? []) {
      if (row?.symbol && row.extra) extras.set(normSymbol(row.symbol), { ...row.extra });
    }
    for (const row of stored.instrumentPolicy ?? []) {
      if (row?.symbol && row.override) setForexInstrumentPolicyOverride(row.symbol, row.override);
    }
    if (stored.leverage?.globalMaxLeverage) setForexLeverageOverride('globalMaxLeverage', stored.leverage.globalMaxLeverage);
    if (stored.leverage?.defaultAccountLeverage) setForexLeverageOverride('defaultAccountLeverage', stored.leverage.defaultAccountLeverage);
    if (stored.margin?.marginWarningLevel) setForexMarginOverride('marginWarningLevel', stored.margin.marginWarningLevel);
    if (stored.margin?.marginCallLevel) setForexMarginOverride('marginCallLevel', stored.margin.marginCallLevel);
    if (stored.margin?.stopOutLevel) setForexMarginOverride('stopOutLevel', stored.margin.stopOutLevel);
    if (stored.margin?.maintenanceRatio) setForexMarginOverride('maintenanceRatio', stored.margin.maintenanceRatio);
    for (const row of stored.tradingStatus ?? []) {
      if (row?.symbol && (row.tradingStatus === 'active' || row.tradingStatus === 'halted' || row.tradingStatus === 'closed')) {
        setForexInstrumentTradingStatus(row.symbol, row.tradingStatus);
      }
    }
    for (const key of ['killSwitch', 'demoFundingEnabled', 'fundingTestApiEnabled', 'executionTestApiEnabled'] as const) {
      if (typeof stored.runtimeBools?.[key] === 'boolean') setForexRuntimeBool(key, stored.runtimeBools[key]);
    }
    if (stored.commission) {
      const { setForexGlobalCommission } = await import('../fees/policy.js');
      const model = stored.commission.model;
      setForexGlobalCommission({
        ...(model === 'none' || model === 'per_lot' || model === 'per_side' || model === 'percentage' ? { model } : {}),
        ...(stored.commission.rate != null ? { rate: stored.commission.rate } : {}),
        ...(stored.commission.buyRate != null ? { buyRate: stored.commission.buyRate } : {}),
        ...(stored.commission.sellRate != null ? { sellRate: stored.commission.sellRate } : {}),
        ...(stored.commission.minimum != null ? { minimum: stored.commission.minimum } : {}),
      });
    }
    if (stored.swap) {
      const { setForexGlobalSwap } = await import('../swap/policy.js');
      const model = stored.swap.model;
      setForexGlobalSwap({
        ...(stored.swap.longSwap != null ? { longSwap: stored.swap.longSwap } : {}),
        ...(stored.swap.shortSwap != null ? { shortSwap: stored.swap.shortSwap } : {}),
        ...(stored.swap.rolloverTime != null ? { rolloverTime: stored.swap.rolloverTime } : {}),
        ...(stored.swap.timezone != null ? { timezone: stored.swap.timezone } : {}),
        ...(stored.swap.tripleSwapDay != null ? { tripleSwapDay: stored.swap.tripleSwapDay } : {}),
        ...(model === 'points' || model === 'account_currency' ? { model } : {}),
      });
    }
    for (const row of listForexInstrumentDeskExtras()) {
      await applyExtraToEngines(row.symbol, row.extra);
    }
    return true;
  } catch {
    return false;
  }
}

export function resetForexDeskPolicyForTests(): void {
  bookMode = 'B_BOOK';
  orderPolicy = { ...DEFAULT_ORDER_POLICY };
  extras.clear();
}

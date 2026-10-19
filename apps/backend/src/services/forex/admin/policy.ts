/**
 * Admin F4 — economic policy snapshot & runtime edits (fees, swaps, leverage, margin, instrument caps).
 */
import { persistForexDeskPolicy, getForexInstrumentDeskExtra, setForexInstrumentDeskExtra, type ForexDeskSessionWindow } from './desk-policy.js';
import { setForexGlobalCommission, listForexCommissionPolicies, type ForexCommissionModel } from '../fees/policy.js';
import { setForexGlobalSwap, listForexSwapPolicies } from '../swap/policy.js';
import { fxDecimal } from '../decimal-fx.js';
import { FOREX_INSTRUMENT_CATALOG, getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { snapshotForexRiskPolicy } from '../risk/policy.js';
import {
  effectiveDefaultAccountLeverage,
  effectiveGlobalMaxLeverage,
  effectiveMarginCallLevel,
  effectiveMarginWarningLevel,
  effectiveStopOutLevel,
  effectiveMaintenanceRatio,
  forexLeverageEnvBaseline,
  forexLeverageRuntimeOverrides,
  forexMarginEnvBaseline,
  forexMarginRuntimeOverrides,
  listForexInstrumentPolicyOverrides,
  setForexInstrumentPolicyOverride,
  setForexLeverageOverride,
  setForexMarginOverride,
} from './effective-config.js';

const COMMISSION_MODELS = new Set<ForexCommissionModel>(['none', 'per_lot', 'per_side', 'percentage']);

export function buildForexAdminPolicySnapshot() {
  const instrumentOverrides = new Map(listForexInstrumentPolicyOverrides().map((r) => [r.symbol, r.override]));
  const instruments = FOREX_INSTRUMENT_CATALOG.map((i) => {
    const resolved = getForexInstrumentBySymbol(i.symbol)!;
    const ov = instrumentOverrides.get(i.symbol);
    return {
      symbol: i.symbol,
      displaySymbol: i.displaySymbol,
      catalog: {
        maxLeverage: i.maxLeverage,
        minVolume: i.minVolume,
        maxVolume: i.maxVolume,
      },
      effective: {
        maxLeverage: resolved.maxLeverage,
        minVolume: resolved.minVolume,
        maxVolume: resolved.maxVolume,
      },
      overridden: Boolean(ov && Object.keys(ov).length),
    };
  });

  return {
    leverage: {
      effective: {
        globalMax: effectiveGlobalMaxLeverage(),
        defaultAccount: effectiveDefaultAccountLeverage(),
      },
      envBaseline: forexLeverageEnvBaseline(),
      runtimeOverrides: forexLeverageRuntimeOverrides(),
    },
    margin: {
      effective: {
        warningLevel: effectiveMarginWarningLevel(),
        callLevel: effectiveMarginCallLevel(),
        stopOutLevel: effectiveStopOutLevel(),
        maintenanceRatio: effectiveMaintenanceRatio(),
      },
      envBaseline: forexMarginEnvBaseline(),
      runtimeOverrides: forexMarginRuntimeOverrides(),
    },
    commission: listForexCommissionPolicies(),
    swaps: listForexSwapPolicies(),
    instruments,
    riskLimits: snapshotForexRiskPolicy(),
  };
}

export type ForexAdminPolicyPatch = {
  reason: string;
  leverage?: { global_max?: string; default_account?: string };
  margin?: {
    warning_level?: string;
    call_level?: string;
    stop_out_level?: string;
    maintenance_ratio?: string;
  };
  commission?: { model?: string; rate?: string; minimum?: string };
  swap?: {
    long_swap?: string;
    short_swap?: string;
    rollover_time?: string;
    timezone?: string;
    triple_swap_day?: number;
  };
};

export function applyForexAdminPolicyPatch(patch: ForexAdminPolicyPatch): Array<{ field: string; previous: unknown; next: unknown }> {
  const changes: Array<{ field: string; previous: unknown; next: unknown }> = [];

  if (patch.leverage?.global_max) {
    const ch = setForexLeverageOverride('globalMaxLeverage', patch.leverage.global_max);
    changes.push({ field: 'leverage.global_max', previous: ch.previous, next: ch.next });
  }
  if (patch.leverage?.default_account) {
    const ch = setForexLeverageOverride('defaultAccountLeverage', patch.leverage.default_account);
    changes.push({ field: 'leverage.default_account', previous: ch.previous, next: ch.next });
  }
  if (patch.margin?.warning_level) {
    const ch = setForexMarginOverride('marginWarningLevel', patch.margin.warning_level);
    changes.push({ field: 'margin.warning_level', previous: ch.previous, next: ch.next });
  }
  if (patch.margin?.call_level) {
    const ch = setForexMarginOverride('marginCallLevel', patch.margin.call_level);
    changes.push({ field: 'margin.call_level', previous: ch.previous, next: ch.next });
  }
  if (patch.margin?.stop_out_level) {
    const ch = setForexMarginOverride('stopOutLevel', patch.margin.stop_out_level);
    changes.push({ field: 'margin.stop_out_level', previous: ch.previous, next: ch.next });
  }
  if (patch.margin?.maintenance_ratio) {
    const ch = setForexMarginOverride('maintenanceRatio', patch.margin.maintenance_ratio);
    changes.push({ field: 'margin.maintenance_ratio', previous: ch.previous, next: ch.next });
  }

  if (patch.commission) {
    const prev = listForexCommissionPolicies().global;
    const model = patch.commission.model?.trim() as ForexCommissionModel | undefined;
    if (model && !COMMISSION_MODELS.has(model)) {
      throw new Error('INVALID_COMMISSION_MODEL');
    }
    setForexGlobalCommission({
      ...(model ? { model } : {}),
      ...(patch.commission.rate != null ? { rate: patch.commission.rate } : {}),
      ...(patch.commission.minimum != null ? { minimum: patch.commission.minimum } : {}),
    });
    changes.push({ field: 'commission.global', previous: prev, next: listForexCommissionPolicies().global });
  }

  if (patch.swap) {
    const prev = listForexSwapPolicies().global;
    setForexGlobalSwap({
      ...(patch.swap.long_swap != null ? { longSwap: patch.swap.long_swap } : {}),
      ...(patch.swap.short_swap != null ? { shortSwap: patch.swap.short_swap } : {}),
      ...(patch.swap.rollover_time != null ? { rolloverTime: patch.swap.rollover_time } : {}),
      ...(patch.swap.timezone != null ? { timezone: patch.swap.timezone } : {}),
      ...(patch.swap.triple_swap_day != null ? { tripleSwapDay: patch.swap.triple_swap_day } : {}),
    });
    changes.push({ field: 'swap.global', previous: prev, next: listForexSwapPolicies().global });
  }

  void persistForexDeskPolicy();
  return changes;
}

export function applyForexInstrumentPolicyPatch(
  symbol: string,
  body: {
    max_leverage?: string;
    min_volume?: string;
    max_volume?: string;
    volume_step?: string;
    swap_long?: string;
    swap_short?: string;
    commission?: string;
    spread_markup_pips?: string;
    stops_level_pips?: string;
    digits?: string | number;
    pip_size?: string;
    tick_size?: string;
    contract_size?: string;
    margin_percent?: string;
    commission_model?: string;
    swap_model?: string;
    trade_session?: ForexDeskSessionWindow | null;
    quote_session?: ForexDeskSessionWindow | null;
  },
): { symbol: string; previous: Record<string, string | undefined>; next: Record<string, string | undefined> } {
  const base = getForexInstrumentBySymbol(symbol);
  if (!base) throw new Error('UNKNOWN_INSTRUMENT');
  // Values feed order validation on every request; a non-numeric or non-positive
  // override would otherwise turn every order for the instrument into a 500.
  const positive = (field: string, raw: string): string => {
    const v = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(v) || !fxDecimal(v).gt(0)) throw new Error(`INVALID_${field}`);
    return v;
  };
  const patch: { maxLeverage?: string; minVolume?: string; maxVolume?: string } = {};
  if (body.max_leverage != null) patch.maxLeverage = positive('MAX_LEVERAGE', String(body.max_leverage));
  if (body.min_volume != null) patch.minVolume = positive('MIN_VOLUME', String(body.min_volume));
  if (body.max_volume != null) patch.maxVolume = positive('MAX_VOLUME', String(body.max_volume));
  const extraPatch = {
    ...(body.volume_step != null ? { volumeStep: String(body.volume_step) } : {}),
    ...(body.swap_long != null ? { swapLong: String(body.swap_long) } : {}),
    ...(body.swap_short != null ? { swapShort: String(body.swap_short) } : {}),
    ...(body.commission != null ? { commission: String(body.commission) } : {}),
    ...(body.spread_markup_pips != null ? { spreadMarkupPips: String(body.spread_markup_pips) } : {}),
    ...(body.stops_level_pips != null ? { stopsLevelPips: String(body.stops_level_pips) } : {}),
    ...(body.digits != null ? { digits: Number(body.digits) } : {}),
    ...(body.pip_size != null ? { pipSize: String(body.pip_size) } : {}),
    ...(body.tick_size != null ? { tickSize: String(body.tick_size) } : {}),
    ...(body.contract_size != null ? { contractSize: String(body.contract_size) } : {}),
    ...(body.margin_percent != null ? { marginPercent: String(body.margin_percent) } : {}),
    ...(body.commission_model != null ? { commissionModel: body.commission_model as 'none' | 'per_lot' | 'per_side' | 'percentage' } : {}),
    ...(body.swap_model != null ? { swapModel: body.swap_model as 'points' | 'account_currency' } : {}),
    ...(body.trade_session !== undefined ? { tradeSession: body.trade_session } : {}),
    ...(body.quote_session !== undefined ? { quoteSession: body.quote_session } : {}),
  };
  if (!Object.keys(patch).length && !Object.keys(extraPatch).length) throw new Error('NO_INSTRUMENT_POLICY_FIELDS');
  const effMin = patch.minVolume ?? base.minVolume;
  const effMax = patch.maxVolume ?? base.maxVolume;
  if (fxDecimal(effMin).gt(effMax)) throw new Error('MIN_VOLUME_ABOVE_MAX_VOLUME');
  const previousExtra = getForexInstrumentDeskExtra(symbol);
  const previousPolicy: { maxLeverage?: string; minVolume?: string; maxVolume?: string } = Object.keys(patch).length
    ? setForexInstrumentPolicyOverride(symbol, patch).previous
    : {};
  const nextExtra = Object.keys(extraPatch).length ? setForexInstrumentDeskExtra(symbol, extraPatch) : previousExtra;
  void persistForexDeskPolicy();
  return {
    symbol: symbol.toUpperCase(),
    previous: {
      maxLeverage: previousPolicy.maxLeverage,
      minVolume: previousPolicy.minVolume,
      maxVolume: previousPolicy.maxVolume,
      volumeStep: previousExtra?.volumeStep,
      swapLong: previousExtra?.swapLong,
      swapShort: previousExtra?.swapShort,
      commission: previousExtra?.commission,
      spreadMarkupPips: previousExtra?.spreadMarkupPips,
      stopsLevelPips: previousExtra?.stopsLevelPips,
      digits: previousExtra?.digits != null ? String(previousExtra.digits) : undefined,
      pipSize: previousExtra?.pipSize,
      tickSize: previousExtra?.tickSize,
      contractSize: previousExtra?.contractSize,
      marginPercent: previousExtra?.marginPercent,
      commissionModel: previousExtra?.commissionModel,
      swapModel: previousExtra?.swapModel,
      tradeSession: previousExtra?.tradeSession ? JSON.stringify(previousExtra.tradeSession) : undefined,
      quoteSession: previousExtra?.quoteSession ? JSON.stringify(previousExtra.quoteSession) : undefined,
    },
    next: {
      maxLeverage: patch.maxLeverage ?? base.maxLeverage,
      minVolume: patch.minVolume ?? base.minVolume,
      maxVolume: patch.maxVolume ?? base.maxVolume,
      volumeStep: nextExtra?.volumeStep,
      swapLong: nextExtra?.swapLong,
      swapShort: nextExtra?.swapShort,
      commission: nextExtra?.commission,
      spreadMarkupPips: nextExtra?.spreadMarkupPips,
      stopsLevelPips: nextExtra?.stopsLevelPips,
      digits: nextExtra?.digits != null ? String(nextExtra.digits) : undefined,
      pipSize: nextExtra?.pipSize,
      tickSize: nextExtra?.tickSize,
      contractSize: nextExtra?.contractSize,
      marginPercent: nextExtra?.marginPercent,
      commissionModel: nextExtra?.commissionModel,
      swapModel: nextExtra?.swapModel,
      tradeSession: nextExtra?.tradeSession ? JSON.stringify(nextExtra.tradeSession) : undefined,
      quoteSession: nextExtra?.quoteSession ? JSON.stringify(nextExtra.quoteSession) : undefined,
    },
  };
}

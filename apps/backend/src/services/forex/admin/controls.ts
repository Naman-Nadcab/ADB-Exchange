/**
 * Admin F3 — global controls snapshot & mutations (read effective + env baseline).
 */
import { getForexAdminBackendConfig } from './config.js';
import {
  effectiveForexRuntimeFlags,
  forexEnvBaselineFlags,
  forexRuntimeBoolOverrides,
  listForexInstrumentTradingStatusOverrides,
  setForexInstrumentTradingStatus,
  setForexRuntimeBool,
  type ForexRuntimeBoolKey,
} from './runtime-controls.js';
import { FOREX_INSTRUMENT_CATALOG, getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { forexReadinessSnapshot } from '../durability/ready.js';
import type { ForexTradingStatus } from '../types.js';
import { FOREX_TRADING_STATUSES } from '../types.js';
import { getForexKycPolicy, type ForexKycPolicy } from '../customer/forex-kyc-policy.service.js';

const STATUS_SET = new Set<string>(FOREX_TRADING_STATUSES);

export function buildForexAdminControlsSnapshot() {
  const effective = effectiveForexRuntimeFlags();
  const envBaseline = forexEnvBaselineFlags();
  const overrides = forexRuntimeBoolOverrides();
  const instrumentOverrides = listForexInstrumentTradingStatusOverrides();
  const overrideBySymbol = new Map(instrumentOverrides.map((r) => [r.symbol, r.tradingStatus]));

  const instruments = FOREX_INSTRUMENT_CATALOG.map((i) => {
    const resolved = getForexInstrumentBySymbol(i.symbol)!;
    return {
      symbol: i.symbol,
      displaySymbol: i.displaySymbol,
      tradingStatus: resolved.tradingStatus,
      catalogDefault: i.tradingStatus,
      overridden: overrideBySymbol.has(i.symbol),
    };
  });

  return {
    effective,
    envBaseline,
    runtimeOverrides: overrides,
    instruments,
    readiness: forexReadinessSnapshot(),
    dealing: getForexAdminBackendConfig().dealing,
  };
}

/** Persisted Forex KYC policy is not an in-memory env override. */
export async function buildForexAdminControlsSnapshotWithKyc(): Promise<
  ReturnType<typeof buildForexAdminControlsSnapshot> & { kycPolicy: ForexKycPolicy }
> {
  const kycPolicy = await getForexKycPolicy();
  return { ...buildForexAdminControlsSnapshot(), kycPolicy };
}

const KEY_MAP: Record<string, ForexRuntimeBoolKey> = {
  kill_switch: 'killSwitch',
  demo_funding: 'demoFundingEnabled',
  funding_test_api: 'fundingTestApiEnabled',
  execution_test_api: 'executionTestApiEnabled',
};

export type ForexAdminControlsPatch = {
  kill_switch?: boolean;
  demo_funding?: boolean;
  funding_test_api?: boolean;
  execution_test_api?: boolean;
};

export function applyForexAdminControlsPatch(patch: ForexAdminControlsPatch): Array<{
  key: ForexRuntimeBoolKey;
  previous: boolean;
  next: boolean;
}> {
  const changes: Array<{ key: ForexRuntimeBoolKey; previous: boolean; next: boolean }> = [];
  for (const [apiKey, cfgKey] of Object.entries(KEY_MAP)) {
    const v = patch[apiKey as keyof ForexAdminControlsPatch];
    if (typeof v !== 'boolean') continue;
    changes.push({ key: cfgKey, ...setForexRuntimeBool(cfgKey, v) });
  }
  return changes;
}

export function applyForexInstrumentStatusPatch(
  symbol: string,
  tradingStatus: string,
): { symbol: string; previous: ForexTradingStatus | null; next: ForexTradingStatus } {
  const status = tradingStatus.trim().toLowerCase();
  if (!STATUS_SET.has(status)) {
    throw new Error('INVALID_TRADING_STATUS');
  }
  const { previous, next } = setForexInstrumentTradingStatus(symbol, status as ForexTradingStatus);
  return { symbol: symbol.toUpperCase(), previous, next };
}

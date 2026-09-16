/**
 * Admin-ready Forex backend configuration snapshot.
 * Future Admin UI reads this contract. Routes must not hardcode policy values.
 * This is not an Admin UI and does not expose mutation APIs.
 */
import {
  effectiveDefaultAccountLeverage,
  effectiveGlobalMaxLeverage,
  effectiveMaintenanceRatio,
  effectiveMarginCallLevel,
  effectiveMarginWarningLevel,
  effectiveStopOutLevel,
} from './effective-config.js';
import { effectiveForexRuntimeFlags } from './runtime-controls.js';
import { forexConfig } from '../config.js';
import { listForexCommissionPolicies } from '../fees/policy.js';
import { FOREX_INSTRUMENT_CATALOG, getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { snapshotForexRiskPolicy } from '../risk/policy.js';
import { getForexDealingSnapshot } from '../risk/dealing.js';
import { forexSessionSnapshot } from '../sessions/eligibility.js';
import { listForexSwapPolicies } from '../swap/policy.js';

export const FOREX_CUSTOMER_ORDER_TYPES = ['market', 'limit', 'stop'] as const;

export function getForexAdminBackendConfig() {
  const sessions = forexSessionSnapshot();
  return {
    source: 'SIMULATED' as const,
    executionMode: 'MOCK' as const,
    realForex: false,
    orderTypes: [...FOREX_CUSTOMER_ORDER_TYPES],
    instruments: FOREX_INSTRUMENT_CATALOG.map((i) => {
      const resolved = getForexInstrumentBySymbol(i.symbol);
      return {
        symbol: i.symbol,
        tradingStatus: resolved?.tradingStatus ?? i.tradingStatus,
        maxLeverage: resolved?.maxLeverage ?? i.maxLeverage,
        minVolume: resolved?.minVolume ?? i.minVolume,
        maxVolume: resolved?.maxVolume ?? i.maxVolume,
        marginPercent: i.marginPercent,
        commission: i.commission,
        commissionType: i.commissionType,
        swapLong: i.swapLong,
        swapShort: i.swapShort,
      };
    }),
    sessions,
    fees: listForexCommissionPolicies(),
    swaps: listForexSwapPolicies(),
    leverage: {
      globalMax: effectiveGlobalMaxLeverage(),
      defaultAccount: effectiveDefaultAccountLeverage(),
    },
    margin: {
      maintenanceRatio: effectiveMaintenanceRatio(),
      warningLevel: effectiveMarginWarningLevel(),
      callLevel: effectiveMarginCallLevel(),
      stopOutLevel: effectiveStopOutLevel(),
    },
    riskLimits: snapshotForexRiskPolicy(),
    dealing: getForexDealingSnapshot('', ''),
    accountRestrictions: {
      killSwitch: effectiveForexRuntimeFlags().killSwitch,
      fundingTestApiEnabled: effectiveForexRuntimeFlags().fundingTestApiEnabled,
      demoFundingEnabled: effectiveForexRuntimeFlags().demoFundingEnabled,
      executionTestApiEnabled: effectiveForexRuntimeFlags().executionTestApiEnabled,
    },
    holiday: {
      coverage: sessions.holidayCoverage,
      required: sessions.holidayRequired,
      holidaySafe: sessions.holidaySafe,
      dstApplied: sessions.dstApplied,
    },
  };
}

export function getForexCustomerTradingConfig() {
  const admin = getForexAdminBackendConfig();
  return {
    source: 'SIMULATED' as const,
    executionMode: 'MOCK' as const,
    orderTypes: admin.orderTypes,
    sessions: admin.sessions,
    fees: { global: admin.fees.global, model: admin.fees.global.model },
    swaps: { rolloverTime: admin.swaps.global.rolloverTime, timezone: admin.swaps.global.timezone },
    leverage: admin.leverage,
    holiday: admin.holiday,
  };
}

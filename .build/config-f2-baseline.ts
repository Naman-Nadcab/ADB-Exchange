/**
 * Admin-ready Forex backend configuration snapshot.
 * Future Admin UI reads this contract. Routes must not hardcode policy values.
 * This is not an Admin UI and does not expose mutation APIs.
 */
import { forexConfig } from '../config.js';
import { listForexCommissionPolicies } from '../fees/policy.js';
import { FOREX_INSTRUMENT_CATALOG } from '../instruments.catalog.js';
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
    instruments: FOREX_INSTRUMENT_CATALOG.map((i) => ({
      symbol: i.symbol,
      tradingStatus: i.tradingStatus,
      maxLeverage: i.maxLeverage,
      marginPercent: i.marginPercent,
      commission: i.commission,
      commissionType: i.commissionType,
      swapLong: i.swapLong,
      swapShort: i.swapShort,
      minVolume: i.minVolume,
      maxVolume: i.maxVolume,
    })),
    sessions,
    fees: listForexCommissionPolicies(),
    swaps: listForexSwapPolicies(),
    leverage: {
      globalMax: forexConfig.globalMaxLeverage,
      defaultAccount: forexConfig.defaultAccountLeverage,
    },
    margin: {
      maintenanceRatio: forexConfig.maintenanceRatio,
      warningLevel: forexConfig.marginWarningLevel,
      callLevel: forexConfig.marginCallLevel,
      stopOutLevel: forexConfig.stopOutLevel,
    },
    riskLimits: snapshotForexRiskPolicy(),
    dealing: getForexDealingSnapshot('', ''),
    accountRestrictions: {
      killSwitch: forexConfig.killSwitch,
      fundingTestApiEnabled: forexConfig.fundingTestApiEnabled,
      demoFundingEnabled: forexConfig.demoFundingEnabled,
      executionTestApiEnabled: forexConfig.executionTestApiEnabled,
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

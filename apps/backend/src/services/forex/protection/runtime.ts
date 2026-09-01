/**
 * Start SL/TP + liquidation + pending-order + rollover listeners at process ready.
 * DATABASE → hydrate → reconcile → Forex-ready. Fail closed on hydrate failure.
 */
import { getForexAccountingService } from '../accounting/service.js';
import { hydrateForexEconomicState } from '../durability/hydrate.js';
import { markForexEconomicFailed } from '../durability/ready.js';
import { getForexExecutionService } from '../execution/service.js';
import { getForexLiquidationService } from '../liquidation/service.js';
import { getForexOrderService } from '../orders/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { getForexRiskService } from '../risk/service.js';
import { getForexSwapService } from '../swap/service.js';
import { getForexProtectionService } from './service.js';

const ROLLOVER_INTERVAL_MS = 60_000;
let rolloverTimer: ReturnType<typeof setInterval> | null = null;

export async function startForexProtectionRuntime(): Promise<void> {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const executions = getForexExecutionService(pricing);
  const orders = getForexOrderService();
  const accounting = getForexAccountingService(positions, pricing);
  const prot = getForexProtectionService(positions, orders, pricing);
  const liq = getForexLiquidationService(positions, orders, accounting);
  const risk = getForexRiskService(positions, pricing);
  const swaps = getForexSwapService(positions, accounting);
  try {
    await hydrateForexEconomicState({
      orders,
      executions,
      positions,
      accounting,
      protections: prot,
      liquidations: liq,
      risk,
      swaps,
    });
  } catch (err) {
    markForexEconomicFailed(err instanceof Error ? err.message : 'FOREX_HYDRATE_FAILED');
    throw err;
  }
  if (!rolloverTimer) {
    rolloverTimer = setInterval(() => {
      void swaps.applyRollover(new Date());
    }, ROLLOVER_INTERVAL_MS);
    rolloverTimer.unref?.();
  }
}

export function stopForexAdvancedRuntime(): void {
  if (rolloverTimer) {
    clearInterval(rolloverTimer);
    rolloverTimer = null;
  }
}

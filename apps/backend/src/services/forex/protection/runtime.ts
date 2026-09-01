/**
 * Start SL/TP + liquidation + pending-order + rollover listeners at process ready.
 * One bounded rollover timer for the process — not per user or per symbol.
 */
import { getForexAccountingService } from '../accounting/service.js';
import { getForexLiquidationService } from '../liquidation/service.js';
import { getForexOrderService } from '../orders/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { recoverForexRuntime } from '../recovery/service.js';
import { getForexRiskService } from '../risk/service.js';
import { getForexSwapService } from '../swap/service.js';
import { getForexProtectionService } from './service.js';

const ROLLOVER_INTERVAL_MS = 60_000;
let rolloverTimer: ReturnType<typeof setInterval> | null = null;

export async function startForexProtectionRuntime(): Promise<void> {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const orders = getForexOrderService();
  const accounting = getForexAccountingService(positions, pricing);
  const prot = getForexProtectionService(positions, orders, pricing);
  const liq = getForexLiquidationService(positions, orders, accounting);
  await orders.hydrateFromDb().catch(() => undefined);
  await prot.hydrateFromDb().catch(() => undefined);
  await liq.hydrateFromDb().catch(() => undefined);
  const risk = getForexRiskService(positions, pricing);
  risk.setPersistEnabled(true);
  await risk.hydrateFromDb().catch(() => undefined);
  const swaps = getForexSwapService(positions, accounting);
  recoverForexRuntime({ orders, positions, accounting, protections: prot, liquidations: liq, risk, swaps });
  if (!rolloverTimer) {
    rolloverTimer = setInterval(() => {
      void swaps.applyRollover(new Date()).catch(() => undefined);
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

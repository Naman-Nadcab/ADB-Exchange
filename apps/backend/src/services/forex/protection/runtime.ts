/**
 * Start SL/TP + liquidation listeners at process ready so quote/fill
 * evaluation does not wait for the first authenticated HTTP call.
 */
import { getForexAccountingService } from '../accounting/service.js';
import { getForexLiquidationService } from '../liquidation/service.js';
import { getForexOrderService } from '../orders/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { getForexRiskService } from '../risk/service.js';
import { getForexProtectionService } from './service.js';

export async function startForexProtectionRuntime(): Promise<void> {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const orders = getForexOrderService();
  const accounting = getForexAccountingService(positions, pricing);
  const prot = getForexProtectionService(positions, orders, pricing);
  const liq = getForexLiquidationService(positions, orders, accounting);
  await prot.hydrateFromDb().catch(() => undefined);
  await liq.hydrateFromDb().catch(() => undefined);
  const risk = getForexRiskService(positions, pricing);
  risk.setPersistEnabled(true);
  await risk.hydrateFromDb().catch(() => undefined);
}

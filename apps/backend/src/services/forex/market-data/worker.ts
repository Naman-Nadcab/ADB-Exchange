import { logger } from '../../../lib/logger.js';
import { forexConfig } from '../config.js';
import { listForexSymbols } from '../instruments.catalog.js';
import { getForexPricingService } from '../quotes.service.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startForexMarketDataWorker(): void {
  if (!forexConfig.marketDataEnabled) {
    logger.info('Forex market-data worker disabled (FOREX_MARKET_DATA_ENABLED=false)');
    return;
  }
  if (timer) return;
  const svc = getForexPricingService();
  svc.startPrimary(listForexSymbols());
  timer = setInterval(() => {
    try {
      svc.tick(new Date());
    } catch (err) {
      logger.warn('Forex market-data tick failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, forexConfig.marketDataIntervalMs);
  logger.info('Forex market-data worker started', {
    intervalMs: forexConfig.marketDataIntervalMs,
    provider: 'MOCK-A',
    source: 'SIMULATED',
    symbols: listForexSymbols().length,
  });
}

export function stopForexMarketDataWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  getForexPricingService().stopAll();
}

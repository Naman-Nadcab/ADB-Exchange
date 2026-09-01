import { logger } from '../../../lib/logger.js';
import { forexConfig } from '../config.js';
import { listForexSymbols } from '../instruments.catalog.js';
import { getForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startForexMarketDataWorker(): void {
  if (!forexConfig.marketDataEnabled) {
    logger.info('Forex market-data worker disabled (FOREX_MARKET_DATA_ENABLED=false)');
    return;
  }
  if (timer) return;
  const svc = getForexPricingService();
  svc.startAll(listForexSymbols());
  timer = setInterval(() => {
    try {
      const now = new Date();
      svc.tick(now);
      for (const symbol of listForexSymbols()) {
        forexWsHub.publishLiquidity(svc.getRoutingSnapshot(symbol, now));
      }
    } catch (err) {
      logger.warn('Forex market-data tick failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, forexConfig.marketDataIntervalMs);
  logger.info('Forex market-data worker started', {
    intervalMs: forexConfig.marketDataIntervalMs,
    providers: ['MOCK-A', 'MOCK-B', 'MOCK-C'],
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

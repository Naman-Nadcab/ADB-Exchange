import { logger } from '../../../lib/logger.js';
import { forexConfig } from '../config.js';
import { listForexSymbols } from '../instruments.catalog.js';
import { getForexPricingService } from '../quotes.service.js';
import { forexWsHub } from '../ws/hub.js';
import { forexMockAnchorEnabled, forexMockAnchorRefreshMs, refreshForexMockAnchors } from './anchor.js';
import { lpPlugArmed } from '../lp/lp-api-client.js';

let timer: ReturnType<typeof setInterval> | null = null;
let anchorTimer: ReturnType<typeof setInterval> | null = null;

/** Never blocks startup or ticking. Failure leaves the authored constants in place. */
function scheduleAnchorRefresh(): void {
  if (!forexMockAnchorEnabled() || anchorTimer) return;
  const run = () => {
    void refreshForexMockAnchors(listForexSymbols()).catch((err: unknown) => {
      logger.warn('Forex mock anchor refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  };
  run();
  anchorTimer = setInterval(run, forexMockAnchorRefreshMs());
  // Anchoring is a background refresh — it must never hold the event loop open.
  anchorTimer.unref?.();
}

export function startForexMarketDataWorker(): void {
  if (!forexConfig.marketDataEnabled) {
    logger.info('Forex market-data worker disabled (FOREX_MARKET_DATA_ENABLED=false)');
    return;
  }
  if (timer) return;
  const svc = getForexPricingService();
  svc.startAll(listForexSymbols());
  scheduleAnchorRefresh();
  timer = setInterval(() => {
    try {
      const now = new Date();
      svc.tick(now);
      if (lpPlugArmed()) {
        void import('../lp/lp-quotes.js')
          .then((m) => m.pullLpQuotesIntoBook())
          .catch((err: unknown) => {
            logger.warn('Forex LP quote pull failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      for (const symbol of listForexSymbols()) {
        forexWsHub.publishLiquidity(svc.getRoutingSnapshot(symbol, now));
        void import('../customer/session-alert-watch.js').then((m) => m.evaluateForexSessionTransitionForSymbol(symbol, now));
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

/** Admin / ops read-only snapshot (F1). */
export function forexMarketDataWorkerSnapshot(): {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  symbols: number;
  providers: string[];
  source: 'SIMULATED';
} {
  return {
    enabled: forexConfig.marketDataEnabled,
    running: timer != null,
    intervalMs: forexConfig.marketDataIntervalMs,
    symbols: listForexSymbols().length,
    providers: ['MOCK-A', 'MOCK-B', 'MOCK-C'],
    source: 'SIMULATED',
  };
}

export function stopForexMarketDataWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (anchorTimer) {
    clearInterval(anchorTimer);
    anchorTimer = null;
  }
  getForexPricingService().stopAll();
}

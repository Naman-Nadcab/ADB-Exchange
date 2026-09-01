/**
 * Deterministic Forex rollover job contract.
 * Applies swap only when the configured rollover moment is met.
 * Idempotent per position + rollover date. Never touches Crypto ledger.
 */
import { randomUUID } from 'node:crypto';
import { forexSwapAppliedTotal, forexSwapSkippedTotal } from '../../../lib/forex-prometheus-metrics.js';
import type { ForexAccountingService } from '../accounting/service.js';
import type { ForexPositionService } from '../positions/service.js';
import { calculateForexSwap, isRolloverMoment, rolloverDateKey } from './engine.js';
import { resolveForexSwap } from './policy.js';

export interface ForexSwapEvent {
  eventId: string;
  accountId: string;
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  amount: string;
  rolloverDate: string;
  triple: boolean;
  idempotencyKey: string;
  transactionId?: string;
  timestamp: string;
  source: 'SIMULATED';
}

export class ForexSwapService {
  readonly events: ForexSwapEvent[] = [];
  private readonly applied = new Set<string>();
  private lastRolloverDate: string | null = null;

  constructor(
    private readonly positions: ForexPositionService,
    private readonly accounting: ForexAccountingService
  ) {}

  listOwned(accountId: string): ForexSwapEvent[] {
    return this.events.filter((e) => e.accountId === accountId);
  }

  /**
   * Evaluate rollover at `at`. No-op unless the session/rollover condition is met
   * and this UTC date has not already been processed.
   */
  async applyRollover(at: Date): Promise<ForexSwapEvent[]> {
    const rule = resolveForexSwap('EURUSD');
    if (!isRolloverMoment(at, rule.rolloverTime)) {
      forexSwapSkippedTotal.inc({ reason: 'NOT_ROLLOVER_TIME' });
      return [];
    }
    const date = rolloverDateKey(at);
    if (this.lastRolloverDate === date) {
      forexSwapSkippedTotal.inc({ reason: 'ALREADY_APPLIED_DATE' });
      return [];
    }
    const applied: ForexSwapEvent[] = [];
    for (const p of this.positions.store.listOpen()) {
      const key = `SWAP:${p.positionId}:${date}`;
      if (this.applied.has(key) || this.accounting.ledger.store.getByKey(key)) {
        forexSwapSkippedTotal.inc({ reason: 'IDEMPOTENT' });
        continue;
      }
      const calc = calculateForexSwap({ symbol: p.symbol, side: p.side, volume: p.volume, at });
      const tx = await this.accounting.postSwap({
        accountId: p.accountId,
        positionId: p.positionId,
        symbol: p.symbol,
        amount: calc.amount,
        idempotencyKey: key,
        metadata: { ...calc, volume: p.volume },
      });
      this.applied.add(key);
      const event: ForexSwapEvent = {
        eventId: randomUUID(),
        accountId: p.accountId,
        positionId: p.positionId,
        symbol: p.symbol,
        side: p.side,
        amount: calc.amount,
        rolloverDate: date,
        triple: calc.triple,
        idempotencyKey: key,
        transactionId: tx?.transactionId,
        timestamp: at.toISOString(),
        source: 'SIMULATED',
      };
      this.events.push(event);
      forexSwapAppliedTotal.inc({ symbol: p.symbol, triple: calc.triple ? '1' : '0' });
      applied.push(event);
    }
    this.lastRolloverDate = date;
    return applied;
  }

  recover(): void {
    for (const e of this.events) this.applied.add(e.idempotencyKey);
  }
}

let swapSingleton: ForexSwapService | null = null;

export function getForexSwapService(positions: ForexPositionService, accounting: ForexAccountingService): ForexSwapService {
  if (!swapSingleton) swapSingleton = new ForexSwapService(positions, accounting);
  return swapSingleton;
}

export function resetForexSwapServiceForTests(positions: ForexPositionService, accounting: ForexAccountingService): ForexSwapService {
  swapSingleton = new ForexSwapService(positions, accounting);
  return swapSingleton;
}

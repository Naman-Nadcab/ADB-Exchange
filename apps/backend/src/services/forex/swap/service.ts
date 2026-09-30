/**
 * Deterministic Forex rollover job contract.
 * Applies swap only when the configured rollover moment is met.
 * Idempotent per position + rollover date. Never touches Crypto ledger.
 */
import { randomUUID } from 'node:crypto';
import { forexSwapAppliedTotal, forexSwapSkippedTotal } from '../../../lib/forex-prometheus-metrics.js';
import type { ForexAccountingService } from '../accounting/service.js';
import { persistSwapEvent } from '../advanced/persist.js';
import { lockForexSwapKey, withForexTransaction } from '../durability/tx.js';
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
  private persistEnabled = false;

  constructor(
    private readonly positions: ForexPositionService,
    private readonly accounting: ForexAccountingService,
    persistEnabled = false
  ) {
    this.persistEnabled = persistEnabled;
  }

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  listOwned(accountId: string): ForexSwapEvent[] {
    return this.events.filter((e) => e.accountId === accountId);
  }

  hydrate(events: ForexSwapEvent[]): void {
    for (const e of events) {
      this.events.push(e);
      this.applied.add(e.idempotencyKey);
    }
  }

  /**
   * Evaluate rollover at `at`. No-op unless the session/rollover condition is met.
   * Per-position key SWAP:{positionId}:{date} is the durable uniqueness barrier.
   */
  async applyRollover(at: Date): Promise<ForexSwapEvent[]> {
    const rule = resolveForexSwap('EURUSD');
    if (!isRolloverMoment(at, rule.rolloverTime)) {
      forexSwapSkippedTotal.inc({ reason: 'NOT_ROLLOVER_TIME' });
      return [];
    }
    const date = rolloverDateKey(at);
    const applied: ForexSwapEvent[] = [];
    for (const p of this.positions.store.listOpen()) {
      const key = `SWAP:${p.positionId}:${date}`;
      if (this.applied.has(key) || this.accounting.ledger.store.getByKey(key)) {
        forexSwapSkippedTotal.inc({ reason: 'IDEMPOTENT' });
        continue;
      }
      const calc = calculateForexSwap({ symbol: p.symbol, side: p.side, volume: p.volume, at, accountId: p.accountId });
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
        timestamp: at.toISOString(),
        source: 'SIMULATED',
      };
      if (this.persistEnabled) {
        const posted = await withForexTransaction(async (client) => {
          await lockForexSwapKey(client, key);
          const inserted = await persistSwapEvent(event, client);
          if (inserted !== 'inserted') return null;
          const tx = await this.accounting.postSwap(
            {
              accountId: p.accountId,
              positionId: p.positionId,
              symbol: p.symbol,
              amount: calc.amount,
              idempotencyKey: key,
              metadata: { ...calc, volume: p.volume },
            },
            client
          );
          event.transactionId = tx?.transactionId;
          return { event, tx };
        });
        if (!posted) {
          this.applied.add(key);
          forexSwapSkippedTotal.inc({ reason: 'IDEMPOTENT' });
          continue;
        }
        if (posted.tx) this.accounting.ledger.store.put(posted.tx);
        this.applied.add(key);
        this.events.push(posted.event);
        forexSwapAppliedTotal.inc({ symbol: p.symbol, triple: calc.triple ? '1' : '0' });
        applied.push(posted.event);
        continue;
      }
      const tx = await this.accounting.postSwap({
        accountId: p.accountId,
        positionId: p.positionId,
        symbol: p.symbol,
        amount: calc.amount,
        idempotencyKey: key,
        metadata: { ...calc, volume: p.volume },
      });
      event.transactionId = tx?.transactionId;
      this.applied.add(key);
      this.events.push(event);
      forexSwapAppliedTotal.inc({ symbol: p.symbol, triple: calc.triple ? '1' : '0' });
      applied.push(event);
    }
    return applied;
  }

  recover(): void {
    for (const e of this.events) this.applied.add(e.idempotencyKey);
  }
}

let swapSingleton: ForexSwapService | null = null;

export function getForexSwapService(positions: ForexPositionService, accounting: ForexAccountingService): ForexSwapService {
  if (!swapSingleton) swapSingleton = new ForexSwapService(positions, accounting, true);
  return swapSingleton;
}

export function resetForexSwapServiceForTests(positions: ForexPositionService, accounting: ForexAccountingService): ForexSwapService {
  swapSingleton = new ForexSwapService(positions, accounting, false);
  return swapSingleton;
}

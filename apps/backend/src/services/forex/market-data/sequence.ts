import type { SequenceDecision } from '../types.js';

/**
 * Deterministic provider-sequence policy.
 * Gaps are allowed (drops). Duplicates and regressions never rewrite history.
 */
export function decideSequence(last: bigint | undefined, incoming: bigint): SequenceDecision {
  if (typeof incoming !== 'bigint' || incoming < 0n) {
    return { action: 'out_of_order', reason: 'MALFORMED_SEQUENCE', lastSequence: last };
  }
  if (last === undefined) {
    return { action: 'accept' };
  }
  if (incoming === last) {
    return { action: 'duplicate', reason: 'DUPLICATE_SEQUENCE', lastSequence: last };
  }
  if (incoming < last) {
    return { action: 'out_of_order', reason: 'OUT_OF_ORDER_SEQUENCE', lastSequence: last };
  }
  return { action: 'accept', lastSequence: last };
}

export class ProviderSequenceTracker {
  private readonly last = new Map<string, bigint>();

  key(providerId: string, symbol: string): string {
    return `${providerId}:${symbol}`;
  }

  peek(providerId: string, symbol: string): bigint | undefined {
    return this.last.get(this.key(providerId, symbol));
  }

  decide(providerId: string, symbol: string, incoming: bigint): SequenceDecision {
    return decideSequence(this.peek(providerId, symbol), incoming);
  }

  commit(providerId: string, symbol: string, incoming: bigint): void {
    this.last.set(this.key(providerId, symbol), incoming);
  }
}

export class EdaReceiveSequence {
  private n = 0n;

  next(): bigint {
    this.n += 1n;
    return this.n;
  }

  current(): bigint {
    return this.n;
  }
}

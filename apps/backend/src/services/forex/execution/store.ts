import type { ForexExecutionRecord } from './models.js';
import { executionFingerprint } from './request.js';
import type { ForexExecutionRequest } from './request.js';
import { ForexExecutionError } from './models.js';

/**
 * Durable-enough store for Phase 3. Memory is the working set; persist hydrates it.
 * Restart recovery uses this map after load — never resubmit SUBMITTED rows automatically.
 */
export class ForexExecutionStore {
  private readonly byExec = new Map<string, ForexExecutionRecord>();
  private readonly byClient = new Map<string, string>();

  put(record: ForexExecutionRecord): void {
    this.byExec.set(record.executionId, record);
    this.byClient.set(record.clientExecId, record.executionId);
  }

  get(executionId: string): ForexExecutionRecord | undefined {
    return this.byExec.get(executionId);
  }

  getByClient(clientExecId: string): ForexExecutionRecord | undefined {
    const id = this.byClient.get(clientExecId);
    return id ? this.byExec.get(id) : undefined;
  }

  claimIdempotency(req: ForexExecutionRequest): ForexExecutionRecord | 'conflict' | undefined {
    const existing = this.getByClient(req.clientExecId);
    if (!existing) return undefined;
    if (existing.fingerprint === executionFingerprint(req)) return existing;
    return 'conflict';
  }

  requireExistingSame(req: ForexExecutionRequest): ForexExecutionRecord {
    const hit = this.claimIdempotency(req);
    if (hit === 'conflict') throw new ForexExecutionError('IDEMPOTENCY_CONFLICT', 'clientExecId reused with a different request');
    if (!hit) throw new ForexExecutionError('INVALID_CLIENT_EXEC_ID', 'execution not found');
    return hit;
  }

  listOpen(): ForexExecutionRecord[] {
    return [...this.byExec.values()].filter((r) => r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED' || r.status === 'PARTIALLY_FILLED');
  }

  hydrate(records: ForexExecutionRecord[]): void {
    for (const r of records) this.put(r);
  }

  snapshot(): ForexExecutionRecord[] {
    return [...this.byExec.values()].map((r) => ({
      ...r,
      attempts: r.attempts.map((a) => ({ ...a })),
      fills: r.fills.map((f) => ({ ...f })),
      events: r.events.map((e) => ({ ...e })),
    }));
  }
}

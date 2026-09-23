/**
 * Client-observed journal from authoritative store snapshots.
 * Not a secret-bearing server log. No fabricated events.
 */
import type { ForexFillRow, ForexPublicOrder, ForexPublicPosition, ForexPublicProtection } from './types';

export type JournalSeverity = 'info' | 'warn' | 'error';

export interface JournalEntry {
  id: string;
  timestamp: string;
  severity: JournalSeverity;
  category: string;
  message: string;
  referenceId?: string;
}

export function buildForexJournal(args: {
  orders: ForexPublicOrder[];
  fills: ForexFillRow[];
  positions: ForexPublicPosition[];
  protections: ForexPublicProtection[];
  hydratePhase: string;
  socketState: string;
}): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const o of args.orders) {
    const st = String(o.status).toUpperCase();
    const sev: JournalSeverity = st === 'REJECTED' || st === 'FAILED' ? 'error' : st === 'CANCELLED' ? 'warn' : 'info';
    out.push({
      id: `ord-${o.orderId}-${o.updatedAt}`,
      timestamp: o.updatedAt || o.createdAt,
      severity: sev,
      category: 'order',
      message: `${o.side.toUpperCase()} ${o.type} ${o.symbol} ${o.requestedVolume} → ${o.status}${
        o.failureReason ? ` · ${o.failureReason}` : ''
      }`,
      referenceId: o.orderId,
    });
  }
  for (const f of args.fills) {
    out.push({
      id: `fill-${f.fillId}`,
      timestamp: f.timestamp,
      severity: 'info',
      category: 'fill',
      message: `Fill ${f.side} ${f.symbol} ${f.volume} @ ${f.price}`,
      referenceId: f.fillId,
    });
  }
  for (const p of args.positions) {
    if (p.status === 'CLOSED') {
      out.push({
        id: `pos-${p.positionId}-closed`,
        timestamp: p.closedAt ?? p.updatedAt,
        severity: 'info',
        category: 'position',
        message: `Position closed ${p.symbol} ${p.side} ${p.volume}`,
        referenceId: p.positionId,
      });
    }
  }
  for (const pr of args.protections) {
    out.push({
      id: `prot-${pr.protectionId}-${pr.status}`,
      timestamp: new Date().toISOString(),
      severity: pr.status === 'FAILED' ? 'error' : pr.status === 'TRIGGERED' || pr.status === 'FILLED' ? 'warn' : 'info',
      category: pr.type === 'STOP_LOSS' ? 'sl' : 'tp',
      message: `${pr.type} ${pr.symbol} @ ${pr.triggerPrice} → ${pr.status}${
        pr.trailingDistance ? ` · trail ${pr.trailingDistance}` : ''
      }${pr.failureReason ? ` · ${pr.failureReason}` : ''}`,
      referenceId: pr.protectionId,
    });
  }
  out.push({
    id: 'session',
    timestamp: new Date().toISOString(),
    severity: args.hydratePhase === 'error' ? 'error' : 'info',
    category: 'system',
    message: `Hydrate ${args.hydratePhase} · socket ${args.socketState}`,
  });
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
}
